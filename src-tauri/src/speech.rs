use serde::Serialize;
use std::io::Write;
use std::time::Duration;
use tauri::Emitter;

static SPEECH_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SpeechProgress {
    stage: String,
    message: String,
    model_id: Option<String>,
    alias: Option<String>,
    percent: Option<f64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Transcription {
    text: String,
    model_id: String,
    elapsed_ms: u128,
}

fn emit_progress(
    app: &tauri::AppHandle,
    stage: &str,
    message: impl Into<String>,
    model_id: Option<String>,
    alias: Option<String>,
    percent: Option<f64>,
) {
    let _ = app.emit(
        "crownkeep-speech-progress",
        SpeechProgress {
            stage: stage.to_string(),
            message: message.into(),
            model_id,
            alias,
            percent,
        },
    );
}

async fn restart_service_if_needed(
    manager: &foundry_local_sdk::FoundryLocalManager,
    should_restart: bool,
) -> Result<(), String> {
    if !should_restart {
        return Ok(());
    }
    manager
        .start_web_service()
        .await
        .map_err(|e| format!("Chat model restored but the local service could not restart: {e}"))
}

#[tauri::command]
pub async fn crownkeep_transcribe(
    app: tauri::AppHandle,
    audio: Vec<u8>,
    model_id: String,
) -> Result<Transcription, String> {
    let _speech_guard = SPEECH_LOCK
        .try_lock()
        .map_err(|_| "Dictation is already active.")?;
    let _lifecycle_guard = super::FOUNDRY_LIFECYCLE_LOCK.lock().await;

    if audio.len() < 44
        || audio.len() > 12_000_000
        || &audio[..4] != b"RIFF"
        || &audio[8..12] != b"WAVE"
    {
        return Err("Expected a short WAV microphone recording (maximum 12 MB).".into());
    }

    emit_progress(
        &app,
        "resolving",
        "Preparing local speech model…",
        None,
        Some(model_id.clone()),
        None,
    );

    let model = super::resolve_model(&model_id).await?;
    let info = model.info();
    let task = format!(
        "{} {}",
        info.model_type,
        info.task.as_deref().unwrap_or("")
    )
    .to_lowercase();

    if !task.contains("speech")
        && !task.contains("transcri")
        && !model.alias().starts_with("whisper-")
    {
        return Err("The selected model is not a speech model.".into());
    }

    let mut file = tempfile::Builder::new()
        .prefix("crownkeep-dictation-")
        .suffix(".wav")
        .tempfile()
        .map_err(|e| e.to_string())?;
    file.write_all(&audio).map_err(|e| e.to_string())?;
    file.flush().map_err(|e| e.to_string())?;
    drop(audio);

    let manager = super::foundry_manager()?;
    let service_was_running = !manager
        .urls()
        .map_err(|e| format!("Could not inspect local service state: {e}"))?
        .is_empty();

    let previous = manager
        .catalog()
        .get_loaded_models()
        .await
        .map_err(|e| format!("Could not inspect the active chat model: {e}"))?;

    if service_was_running {
        emit_progress(
            &app,
            "pausing-chat",
            "Pausing chat while CrownKeep transcribes locally…",
            Some(model.id().to_string()),
            Some(model.alias().to_string()),
            None,
        );
        manager
            .stop_web_service()
            .await
            .map_err(|e| format!("Could not pause the local chat service: {e}"))?;
    }

    let preparation: Result<(), String> = async {
        if !model
            .is_cached()
            .await
            .map_err(|e| format!("Could not inspect speech-model cache state: {e}"))?
        {
            let progress_app = app.clone();
            let progress_id = model.id().to_string();
            let progress_alias = model.alias().to_string();
            emit_progress(
                &app,
                "downloading",
                format!("Downloading {} · 0%", model.alias()),
                Some(model.id().to_string()),
                Some(model.alias().to_string()),
                Some(0.0),
            );
            model
                .download(Some(move |progress: f64| {
                    let clamped = progress.clamp(0.0, 100.0);
                    emit_progress(
                        &progress_app,
                        "downloading",
                        format!("Downloading {} · {:.0}%", progress_alias, clamped),
                        Some(progress_id.clone()),
                        Some(progress_alias.clone()),
                        Some(clamped),
                    );
                }))
                .await
                .map_err(|e| format!("Could not download local speech model: {e}"))?;
        }

        emit_progress(
            &app,
            "releasing-chat",
            "Releasing the chat model temporarily…",
            Some(model.id().to_string()),
            Some(model.alias().to_string()),
            Some(100.0),
        );
        for item in &previous {
            item.unload()
                .await
                .map_err(|e| format!("Could not release chat model '{}': {e}", item.id()))?;
        }

        emit_progress(
            &app,
            "loading-speech",
            format!("Loading {}…", model.alias()),
            Some(model.id().to_string()),
            Some(model.alias().to_string()),
            None,
        );
        model
            .load()
            .await
            .map_err(|e| format!("Could not load local speech model: {e}"))?;
        Ok(())
    }
    .await;

    if let Err(error) = preparation {
        for item in &previous {
            let _ = item.load().await;
        }
        let _ = restart_service_if_needed(manager, service_was_running).await;
        emit_progress(
            &app,
            "error",
            format!("Dictation preparation failed. Chat restored. {error}"),
            Some(model.id().to_string()),
            Some(model.alias().to_string()),
            None,
        );
        return Err(error);
    }

    emit_progress(
        &app,
        "transcribing",
        "Transcribing locally…",
        Some(model.id().to_string()),
        Some(model.alias().to_string()),
        None,
    );

    let start = std::time::Instant::now();
    let audio_client = model.create_audio_client();
    let transcription = tokio::time::timeout(
        Duration::from_secs(90),
        audio_client.transcribe(file.path()),
    )
    .await;

    let result = match transcription {
        Ok(Ok(response)) => Ok(Transcription {
            text: response.text,
            model_id: model.id().to_string(),
            elapsed_ms: start.elapsed().as_millis(),
        }),
        Ok(Err(error)) => Err(format!("Local transcription failed: {error}")),
        Err(_) => Err("Local transcription timed out after 90 seconds.".into()),
    };

    emit_progress(
        &app,
        "restoring-chat",
        "Restoring the chat model…",
        Some(model.id().to_string()),
        Some(model.alias().to_string()),
        None,
    );

    let mut recovery = Vec::new();
    if let Err(e) = model.unload().await {
        recovery.push(format!("Speech release failed: {e}"));
    }
    for item in &previous {
        if let Err(e) = item.load().await {
            recovery.push(format!("Chat restore failed for '{}': {e}", item.id()));
        }
    }
    if let Err(e) = restart_service_if_needed(manager, service_was_running).await {
        recovery.push(e);
    }

    if !recovery.is_empty() {
        emit_progress(
            &app,
            "error",
            recovery.join("; "),
            Some(model.id().to_string()),
            Some(model.alias().to_string()),
            None,
        );
        return Err(recovery.join("; "));
    }

    match &result {
        Ok(_) => emit_progress(
            &app,
            "ready",
            "Transcript ready · review before sending.",
            Some(model.id().to_string()),
            Some(model.alias().to_string()),
            Some(100.0),
        ),
        Err(error) => emit_progress(
            &app,
            "error",
            format!("{error} Chat model restored."),
            Some(model.id().to_string()),
            Some(model.alias().to_string()),
            None,
        ),
    }

    result
}

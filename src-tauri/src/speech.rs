use std::io::Write;
use serde::Serialize;

static SPEECH_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Transcription {
    text: String,
    model_id: String,
    elapsed_ms: u128,
}

#[tauri::command]
pub async fn crownkeep_transcribe(audio: Vec<u8>, model_id: String) -> Result<Transcription, String> {
    let _guard = SPEECH_LOCK.try_lock().map_err(|_| "Dictation is already active.")?;
    if audio.len() < 44 || audio.len() > 12_000_000 || &audio[..4] != b"RIFF" || &audio[8..12] != b"WAVE" {
        return Err("Expected a short WAV microphone recording (maximum 12 MB).".into());
    }
    let model = super::resolve_model(&model_id).await?;
    let info = model.info();
    let task = format!("{} {}", info.model_type, info.task.as_deref().unwrap_or("")).to_lowercase();
    if !task.contains("speech") && !task.contains("transcri") && !model.alias().starts_with("whisper-") {
        return Err("The selected model is not a speech model.".into());
    }
    // A random, user-scoped temporary file is removed by RAII on every return path.
    let mut file = tempfile::Builder::new().prefix("crownkeep-dictation-").suffix(".wav").tempfile().map_err(|e| e.to_string())?;
    file.write_all(&audio).map_err(|e| e.to_string())?;
    file.flush().map_err(|e| e.to_string())?;
    drop(audio);
    if !model.is_cached().await.map_err(|e| e.to_string())? {
        model.download(None::<fn(f64)>).await.map_err(|e| e.to_string())?;
    }
    let loaded = super::foundry_manager()?.catalog().get_loaded_models().await.map_err(|e| e.to_string())?;
    // Preserve the prior chat path while ensuring chat + Whisper need not coexist.
    let mut released = Vec::new();
    let result = async {
        for item in loaded {
            item.unload().await.map_err(|e| e.to_string())?;
            released.push(item);
        }
        model.load().await.map_err(|e| e.to_string())?;
        let start = std::time::Instant::now();
        let response = model.create_audio_client().transcribe(file.path()).await.map_err(|e| e.to_string())?;
        Ok(Transcription { text: response.text, model_id: model.id().to_string(), elapsed_ms: start.elapsed().as_millis() })
    }.await;
    let unload = model.unload().await;
    let mut recovery = Vec::new();
    if let Err(e) = unload { recovery.push(format!("Speech release failed: {e}")); }
    for item in released {
        if let Err(e) = item.load().await { recovery.push(format!("Chat restore failed: {e}")); }
    }
    if !recovery.is_empty() { return Err(recovery.join("; ")); }
    result
}

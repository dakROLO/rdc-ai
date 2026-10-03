//! CrownKeep-owned native CPU decision runtime. No HTTP client or downloads.
mod encoding;
use ort::{session::Session, value::Tensor};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, path::Path, time::Instant};

pub const VERSION: &str = "Julia-1/82a2fad/fp32";
// Promotion requires held-out CrownKeep evidence, native parity and device budget.
// Research smoke/eval results do not authorize production categories.
pub const QUALIFIED_JOBS: &[&str] = &[];
#[derive(Deserialize)]
pub struct OptionLabel { pub id: String, pub description: String }
fn choice() -> String { "choice".into() }
#[derive(Deserialize)]
pub struct DecisionRequest { #[serde(default = "choice", rename = "type")] pub kind: String, pub job: String, pub state: String, pub question: String, pub options: Vec<OptionLabel> }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DecisionResult { pub selected: String, pub confidence: f32, pub scores: BTreeMap<String, f32>, pub latency_ms: f64 }
#[derive(Deserialize)]
struct Encoded { ids: Vec<i64>, markers: Vec<i64>, qtype: i64 }
pub struct Engine { session: Session, encoder: encoding::JuliaEncoder }
fn verified(path: &Path, expected: &str) -> Result<(), String> {
    use std::io::Read;
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hash = Sha256::new(); let mut buffer = [0u8; 65536];
    loop { let count = file.read(&mut buffer).map_err(|e| e.to_string())?; if count == 0 { break; } hash.update(&buffer[..count]); }
    if format!("{:x}", hash.finalize()) != expected { return Err(format!("Julia asset checksum mismatch: {}", path.display())); }
    Ok(())
}
impl Engine {
    pub fn load(directory: &Path) -> Result<Self, String> {
        // Hashes pin the graph/weights/tokenizer. The installer must ship the ORT
        // CPU DLL alongside the app and its license; do not resolve a system DLL.
        let hashes: BTreeMap<String, String> = serde_json::from_str(include_str!("../assets.sha256.json")).map_err(|e| e.to_string())?;
        for (name, hash) in hashes { verified(&directory.join(name), &hash)?; }
        let dll = directory.join(if cfg!(windows) { "onnxruntime.dll" } else { "libonnxruntime.so" });
        if !dll.is_file() { return Err("Native ONNX Runtime CPU library is not installed.".into()); }
        ort::init_from(dll.to_string_lossy()).with_name("CrownKeep Julia CPU").commit().map_err(|e| e.to_string())?;
        let session = Session::builder().map_err(|e| e.to_string())?.with_intra_threads(4).map_err(|e| e.to_string())?.commit_from_file(directory.join("model.onnx")).map_err(|e| e.to_string())?;
        let encoder = encoding::JuliaEncoder::new(&std::fs::read_to_string(directory.join("tokenizer.json")).map_err(|e| e.to_string())?)?;
        Ok(Self { session, encoder })
    }
    pub fn decide(&mut self, request: &DecisionRequest) -> Result<DecisionResult, String> {
        let began = Instant::now();
        if request.state.len() > 24000 || request.question.len() > 2000 || request.options.len() < 2 || request.options.len() > 20 { return Err("Decision request exceeds bounded contract.".into()); }
        let unique: std::collections::BTreeSet<_> = request.options.iter().map(|x| &x.id).collect();
        if unique.len() != request.options.len() || request.options.iter().any(|x| x.id.is_empty()) { return Err("Decision option IDs must be unique and nonempty.".into()); }
        let row = serde_json::json!({"state": request.state, "question": request.question, "options": request.options.iter().map(|x| &x.description).collect::<Vec<_>>(), "type": request.kind});
        let mut encoded: Encoded = serde_json::from_str(&self.encoder.encode(&row.to_string(), 1024, 512, true)?).map_err(|e| e.to_string())?;
        let count = encoded.ids.len(); let length = count.div_ceil(8) * 8; let options = encoded.markers.len();
        encoded.ids.resize(length, 0);
        let mut attention = vec![0i64; length]; attention[..count].fill(1);
        let tensor = |shape: Vec<usize>, data: Vec<i64>| Tensor::from_array((shape, data)).map_err(|e| e.to_string());
        let outputs = self.session.run(ort::inputs![
            "input_ids" => tensor(vec![1,length], encoded.ids)?,
            "attention_mask" => tensor(vec![1,length], attention)?,
            "marker_pos" => tensor(vec![1,options], encoded.markers)?,
            "marker_mask" => Tensor::from_array((vec![1,options], vec![true;options])).map_err(|e| e.to_string())?,
            "qtype" => tensor(vec![1], vec![encoded.qtype])?
        ]).map_err(|e| e.to_string())?;
        let (_, logits) = outputs["logits"].try_extract_tensor::<f32>().map_err(|e| e.to_string())?;
        if logits.len() != options || logits.iter().any(|x| !x.is_finite()) { return Err("Invalid Julia output logits.".into()); }
        let peak = logits.iter().copied().fold(f32::NEG_INFINITY, f32::max);
        let weights: Vec<_> = logits.iter().map(|x| (x-peak).exp()).collect(); let total: f32 = weights.iter().sum();
        let scores: BTreeMap<_,_> = request.options.iter().zip(weights).map(|(x,w)| (x.id.clone(), w/total)).collect();
        let (selected, confidence) = scores.iter().max_by(|a,b| a.1.total_cmp(b.1)).ok_or("No decision scores")?;
        Ok(DecisionResult { selected: selected.clone(), confidence: *confidence, scores: scores.clone(), latency_ms: began.elapsed().as_secs_f64()*1000. })
    }
}

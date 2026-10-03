// Adapted from SupersonicLabs/Julia-1-ONNX rust/src/lib.rs at 82a2fad. Apache-2.0; see NOTICE.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokenizers::Tokenizer;

#[derive(Deserialize)]
pub struct EncodingRequest {
    state: Value,
    question: String,
    options: Vec<String>,
    #[serde(default = "choice", rename = "type")]
    kind: String,
}

fn choice() -> String { "choice".into() }

#[derive(Serialize)]
struct Encoded {
    ids: Vec<u32>,
    markers: Vec<usize>,
    qtype: u32,
}

fn encode(tokenizer: &Tokenizer, text: &str) -> Result<Vec<u32>, String> {
    tokenizer.encode(text, false).map(|x| x.get_ids().to_vec()).map_err(|e| e.to_string())
}

fn build(tokenizer: &Tokenizer, row: EncodingRequest, max_length: usize, head_length: usize, strict: bool) -> Result<Encoded, String> {
    let qtype = match row.kind.as_str() { "choice" => 0, "score" => 1, "noul" => 2, _ => return Err("Invalid request type".into()) };
    if row.options.len() < 2 || row.options.len() > 20 || row.options.iter().any(String::is_empty) ||
       (qtype == 2 && row.options.len() != 2) { return Err("Options must contain 2-20 nonempty strings".into()); }
    if head_length + 4 >= max_length { return Err("head_length leaves no context".into()); }
    let state = match row.state { Value::String(x) => x, Value::Object(_) | Value::Array(_) => row.state.to_string(), _ => return Err("Invalid state".into()) };
    let marker = "<mask>";
    if strict && (state.contains(marker) || row.question.contains(marker) || row.options.iter().any(|x| x.contains(marker))) {
        return Err("Reserved model marker in request".into());
    }
    let clean = |s: &str| s.replace(marker, " ");
    let head = encode(tokenizer, &format!("{} question: {}", row.kind, clean(&row.question)))?;
    let option_ids: Vec<Vec<u32>> = row.options.iter().map(|x| encode(tokenizer, &format!(" {}", clean(x)))).collect::<Result<_, _>>()?;
    if strict && option_ids.iter().any(|x| x.len() > 48) { return Err("Option exceeds 48-token model contract".into()); }
    let mut options: Vec<Vec<u32>> = option_ids.iter().map(|x| std::iter::once(4).chain(x.iter().copied().take(48)).collect()).collect();
    let mut budget = head_length as isize - options.iter().map(|x| x.len() as isize).sum::<isize>();
    if budget < 16 {
        let cap = ((head_length.saturating_sub(16)) / options.len()).max(4);
        options.iter_mut().for_each(|x| x.truncate(cap));
        budget = head_length as isize - options.iter().map(|x| x.len() as isize).sum::<isize>();
    }
    if strict && (head.len() as isize > budget || options.iter().zip(&option_ids).any(|(x, y)| x.len() != y.len() + 1)) {
        return Err("Question/options exceed lossless head budget".into());
    }
    let mut ids = vec![2];
    ids.extend(head.into_iter().take((budget.max(8)) as usize));
    ids.push(1);
    let mut markers = Vec::with_capacity(options.len());
    for option in options { markers.push(ids.len()); ids.extend(option); }
    ids.push(1);
    let state_ids = encode(tokenizer, &clean(&state))?;
    let room = max_length.saturating_sub(ids.len() + 1);
    if room < 1 { return Err("Question/options exceed sequence budget".into()); }
    if strict && state_ids.len() > room { return Err("State exceeds lossless context budget".into()); }
    ids.extend(state_ids.into_iter().take(room));
    ids.push(1);
    Ok(Encoded { ids, markers, qtype })
}

pub struct JuliaEncoder {
    tokenizer: Tokenizer,
}

impl JuliaEncoder {
    pub fn new(tokenizer_json: &str) -> Result<Self, String> {
        Ok(Self { tokenizer: Tokenizer::from_bytes(tokenizer_json.as_bytes()).map_err(|e| e.to_string())? })
    }

    pub fn encode(&self, request_json: &str, max_length: usize, head_length: usize, strict: bool) -> Result<String, String> {
        let row: EncodingRequest = serde_json::from_str(request_json).map_err(|e| e.to_string())?;
        serde_json::to_string(&build(&self.tokenizer, row, max_length, head_length, strict)?).map_err(|e| e.to_string())
    }
}


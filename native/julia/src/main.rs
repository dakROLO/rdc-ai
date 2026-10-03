//! Development-only local eval CLI. Never wired to the application permission path.
use crownkeep_decision::{DecisionRequest, Engine};
use std::io::{self, BufRead};
fn main() -> Result<(), String> {
    let directory = std::env::args().nth(1).ok_or("Usage: crownkeep-decision LOCAL_ASSET_DIRECTORY < requests.jsonl")?;
    let mut engine = Engine::load(std::path::Path::new(&directory))?;
    for row in io::stdin().lock().lines() {
        let request: DecisionRequest = serde_json::from_str(&row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        match engine.decide(&request) {
            Ok(result) => println!("{}", serde_json::to_string(&result).map_err(|e| e.to_string())?),
            Err(error) => println!("{}", serde_json::json!({"error":error})),
        }
    }
    Ok(())
}

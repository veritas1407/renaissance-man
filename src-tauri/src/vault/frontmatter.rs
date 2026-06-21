use anyhow::{Context, Result};
use std::path::Path;

use crate::models::ParsedNote;

const FM_DELIMITER: &str = "---";

/// Parse a Markdown file into frontmatter (as JSON Value) + body.
/// Handles the "---\n...\n---\n" YAML frontmatter convention.
pub fn parse_note(content: &str) -> Result<ParsedNote> {
    let content = content.trim_start_matches('\u{feff}'); // strip BOM

    if !content.starts_with(FM_DELIMITER) {
        return Ok(ParsedNote {
            frontmatter: serde_json::Value::Object(Default::default()),
            body: content.to_string(),
        });
    }

    // Find closing ---
    let after_open = &content[FM_DELIMITER.len()..];
    let close_pos = after_open
        .find(&format!("\n{FM_DELIMITER}"))
        .context("unclosed frontmatter block")?;

    let yaml_str = &after_open[..close_pos];
    let body_start = close_pos + FM_DELIMITER.len() + 1; // +1 for the \n
    let body = after_open
        .get(body_start..)
        .unwrap_or("")
        .trim_start_matches('\n')
        .to_string();

    let yaml_value: serde_yaml::Value =
        serde_yaml::from_str(yaml_str).unwrap_or(serde_yaml::Value::Null);
    let fm_json = yaml_to_json(yaml_value);

    Ok(ParsedNote {
        frontmatter: fm_json,
        body,
    })
}

/// Serialize a ParsedNote back to disk atomically (.md.tmp → .md via rename).
/// This is the most safety-critical function in the codebase.
pub fn write_note_atomic(path: &Path, note: &ParsedNote) -> Result<()> {
    let yaml_value = json_to_yaml(&note.frontmatter);
    let yaml_str = serde_yaml::to_string(&yaml_value).context("yaml serialize")?;

    let content = format!("---\n{}---\n\n{}", yaml_str, note.body);

    let tmp_path = path.with_extension("md.tmp");
    std::fs::write(&tmp_path, &content).context("write tmp")?;
    std::fs::rename(&tmp_path, path).context("rename to final")?;

    Ok(())
}

// serde_yaml::Value ↔ serde_json::Value bridge
fn yaml_to_json(v: serde_yaml::Value) -> serde_json::Value {
    match v {
        serde_yaml::Value::Null => serde_json::Value::Null,
        serde_yaml::Value::Bool(b) => serde_json::Value::Bool(b),
        serde_yaml::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                serde_json::Value::Number(i.into())
            } else if let Some(f) = n.as_f64() {
                serde_json::Number::from_f64(f)
                    .map(serde_json::Value::Number)
                    .unwrap_or(serde_json::Value::Null)
            } else {
                serde_json::Value::Null
            }
        }
        serde_yaml::Value::String(s) => serde_json::Value::String(s),
        serde_yaml::Value::Sequence(arr) => {
            serde_json::Value::Array(arr.into_iter().map(yaml_to_json).collect())
        }
        serde_yaml::Value::Mapping(m) => {
            let mut obj = serde_json::Map::new();
            for (k, v) in m {
                if let serde_yaml::Value::String(key) = k {
                    obj.insert(key, yaml_to_json(v));
                }
            }
            serde_json::Value::Object(obj)
        }
        serde_yaml::Value::Tagged(t) => yaml_to_json(t.value),
    }
}

fn json_to_yaml(v: &serde_json::Value) -> serde_yaml::Value {
    match v {
        serde_json::Value::Null => serde_yaml::Value::Null,
        serde_json::Value::Bool(b) => serde_yaml::Value::Bool(*b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                serde_yaml::Value::Number(i.into())
            } else if let Some(f) = n.as_f64() {
                serde_yaml::Value::Number(f.into())
            } else {
                serde_yaml::Value::Null
            }
        }
        serde_json::Value::String(s) => serde_yaml::Value::String(s.clone()),
        serde_json::Value::Array(arr) => {
            serde_yaml::Value::Sequence(arr.iter().map(json_to_yaml).collect())
        }
        serde_json::Value::Object(obj) => {
            let mut m = serde_yaml::Mapping::new();
            for (k, v) in obj {
                m.insert(serde_yaml::Value::String(k.clone()), json_to_yaml(v));
            }
            serde_yaml::Value::Mapping(m)
        }
    }
}

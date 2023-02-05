use downloader::{ verify::*, Downloader };

use std::path::PathBuf;
use std::io::Write as _;
use std::fmt::Write as _;

#[derive(Debug, Default)]
struct ExtEntry {
    name: String,
    js: String,
    license: String,
}

fn parse_extjs() -> Vec<ExtEntry> {
    let path = "../extjs.txt";

    let mut v = Vec::new();
    let mut entry = ExtEntry::default();
    let s = std::fs::read_to_string(path).unwrap();
    let mut n = 0;
    for line in s.lines() {
        if !line.is_empty() {
            match n {
                0 => entry.name = line.to_string(),
                1 => entry.js = line.to_string(),
                2 => entry.license = line.to_string(),
                _ => {},
            }
            n += 1;
        }
        if n >= 3 {
            v.push(entry);
            entry = ExtEntry::default();
            n = 0;
        }
    }

    v
}

fn download(src: &str) -> std::io::Result<()> {
    let extjs = {
        let mut s = String::from(src);
        s.push_str("/assets/extjs");
        s
    };

    std::fs::create_dir_all(&extjs).unwrap();

    pub fn verified() -> Verify {
        std::sync::Arc::new(|_: std::path::PathBuf, _: &SimpleProgress| {
            Verification::Ok
        })
    }

    let mut downloader = Downloader::builder()
        .download_folder(std::path::Path::new(&extjs))
        .parallel_requests(1)
        .build()
        .unwrap();

    let entries = parse_extjs();

    let jss = entries.iter().filter_map(|entry| {
        if entry.js != "none" {
            Some(downloader::Download::new(&entry.js)
                .verify(verified()))
        } else {
            None
        }
    }).collect::<Vec<downloader::Download>>();

    let result = downloader.download(&jss).unwrap();
    for r in result {
        match r {
            Ok(_s) => {
            },
            Err(_e) => {
            }
        }
    }

    // downloads license files

    let license_path = {
        let mut buf = PathBuf::new();
        buf.push(src);
        buf.push("LICENSE.ext.html");
        buf
    };

    let mut dl = Downloader::builder()
        .download_folder(std::env::temp_dir().as_path())
        .parallel_requests(1)
        .build()
        .unwrap();


    let mut add_text = String::new();
    add_text.push_str(r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
</head>
<body style="margin-left: 1em;">
<pre>"#);
    let mut licenses = Vec::new();

    for entry in entries.iter() {
        if entry.license.starts_with("http") {
            licenses.push(downloader::Download::new(&entry.license).verify(verified()));

            for r in dl.download(&licenses).unwrap() {
                match r {
                    Ok(_s) => {}
                    Err(e) => {
                        match e {
                            downloader::Error::Verification(s) |
                            downloader::Error::Download(s) => {
                                if let Ok(data) = std::fs::read_to_string(s.file_name) {
                                    write!(&mut add_text, "{}:\n{}\n-----\n", entry.name, &data).unwrap()
                                }
                            },
                            _ => {
                                println!("{:?}", e);
                            }
                        }
                    }
                }
            }

            licenses.pop();
        } else {
            write!(&mut add_text, "{}:\n{}\n-----\n", entry.name, entry.license).unwrap();
        }
    }

    add_text.push_str(r#"</pre>
</body>
</html>"#);

    let f = std::fs::File::create(license_path)?;
    let mut writer = std::io::BufWriter::new(f);

    writer.write(add_text.as_bytes())?;

    Ok(())
}

fn make_frame(src: &str) {
    let mut buf_out = PathBuf::new();
    buf_out.push(src);
    buf_out.push("frame.html");

    let mut s = {
        let mut buf = PathBuf::new();
        buf.push(src);
        buf.push("index.html");
        std::fs::read_to_string(buf.as_path()).unwrap()
    };

    let start = "https://cdn.jsdelivr.net/npm/paper@";
    let end = "/dist/paper-core.min.js";

    if let Some(start_pos) = s.find(start) {
        if let Some(end_pos) = s.find(end) {
            s.replace_range(start_pos..(end_pos + end.len()), "./assets/extjs/paper-core.min.js");
            s = s.replacen("<html lang=\"en\">", "<html lang=\"en\" style=\"overflow-x: hidden;\">", 1);
            std::fs::write(buf_out.as_path(), s).unwrap();
        }
    }
}

#[allow(dead_code)]
fn copy_to_release(src: &str, release: &str) {
    const NAMES: [&'static str; 4] = ["css", "extjs", "font", "img"];

    let mut src_buf = PathBuf::new();
    src_buf.push(src);
    src_buf.push("assets");

    let mut release_buf = PathBuf::new();
    release_buf.push(release);
    release_buf.push("assets");

    for name in NAMES {
        src_buf.push(name);
        release_buf.push(name);
        let _ = std::fs::create_dir_all(release_buf.as_path()).ok();

        if let Ok(reader) = std::fs::read_dir(src_buf.as_path()) {
            for entry in reader {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.is_file() {
                        release_buf.push(entry.file_name());

                        let _ = std::fs::copy(path, release_buf.as_path()).ok();

                        release_buf.pop();
                    }
                }
            }
        }

        src_buf.pop();
        release_buf.pop();
    }
}

fn custom_build() {
    let src = "../src";
    #[allow(unused_variables)]
    let release: &str = "../release";

    download(src).unwrap();
    make_frame(src);
}

fn main() {
    custom_build();

    tauri_build::build();
}

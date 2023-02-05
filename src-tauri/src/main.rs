
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::fmt::Write;
use std::path::{ Path, PathBuf };
use std::time::{ Duration, SystemTime };
use tauri::{
    command,
    Manager, PhysicalPosition, PhysicalSize,
};
use sha1::{Sha1, Digest};


fn next_section(itr: &mut std::iter::Peekable<std::str::CharIndices>) -> Option<(usize, usize, bool)> {
    let (is_number, start) = if let Some((i, c)) = itr.next() {
        ('0' <= c && c <= '9', i)
    } else {
        return None;
    };
    let mut end = start;
    while let Some((i, _c)) = itr.next_if(|&(_i, c)| if is_number { '0' <= c && c <= '9' } else { c < '0' || '9' < c }) {
        end = i;
    }
    Some((start, end + 1, is_number))
}

fn sort_name(a: &&str, b: &&str) -> std::cmp::Ordering {
    let mut it_a = a.char_indices().peekable();
    let mut it_b = b.char_indices().peekable();
    let last_a = a.len();
    let last_b = b.len();
    let mut start_a;
    let mut end_a;
    let mut is_number_a;
    let mut start_b;
    let mut end_b;
    let mut is_number_b;

    loop {
        let a_ret = next_section(&mut it_a);
        let b_ret = next_section(&mut it_b);
        ((start_a, end_a, is_number_a),
         (start_b, end_b, is_number_b)) = if a_ret.is_some() && b_ret.is_some() {
            (a_ret.unwrap(),
             b_ret.unwrap())
        } else {
            if a_ret.is_none() && b_ret.is_none() {
                return std::cmp::Ordering::Equal;
            } else if a_ret.is_none() {
                return std::cmp::Ordering::Less;
            } else {
                return std::cmp::Ordering::Greater;
            }
        };

        if end_a >= last_a || end_b >= last_b || is_number_a != is_number_b {
            end_a = last_a;
            end_b = last_b;
        }

        let a_part = unsafe { a.get_unchecked(start_a..end_a) };
        let b_part = unsafe { b.get_unchecked(start_b..end_b) };

        let r = if let (Ok(a_value), Ok(b_value)) = (a_part.parse::<usize>(), b_part.parse::<usize>()) {
            a_value.cmp(&b_value)
        } else {
            a_part.cmp(&b_part)
        };
        if r != std::cmp::Ordering::Equal {
            return r;
        }
    }
}


#[command]
fn print_string(text: String) {
    println!("{}", text);
}

#[derive(Debug, serde::Serialize)]
enum FileError {
  FileNotFound,
  FailedToWrite,
  FailedToCreate,
}

#[command]
fn file_read(name: String, dir: Option<String>) -> Result<String, FileError> {
    let mut buf = PathBuf::new();
    if let Some(dir) = dir {
        if !dir.is_empty() {
            buf.push(dir);
        }
    }
    buf.push(name);

    if let Ok(data) = std::fs::read_to_string(buf.as_path()) {
        Ok(data)
    } else {
        Err(FileError::FileNotFound)
    }
}

#[command]
fn file_write(name: String, dir: Option<String>, data: String) -> Result<(), FileError> {
    let mut buf = PathBuf::new();
    if let Some(dir) = dir {
        if !dir.is_empty() {
            buf.push(dir);
        }
    }
    buf.push(name);

    if let Ok(()) = std::fs::write(buf.as_path(), data) {
        Ok(())
    } else {
        Err(FileError::FailedToWrite)
    }
}

#[command]
fn file_read_binary(name: String, dir: Option<String>) -> Result<Vec<u8>, FileError> {
    let mut buf = PathBuf::new();
    if let Some(dir) = dir {
        if !dir.is_empty() {
            buf.push(dir);
        }
    }
    buf.push(name);

    if let Ok(data) = std::fs::read(buf.as_path()) {
        Ok(data)
    } else {
        Err(FileError::FileNotFound)
    }
}

#[command]
fn file_write_binary(name: String, dir: Option<String>, data: Vec<u8>) -> Result<(), FileError> {
    let mut buf = PathBuf::new();
    if let Some(dir) = dir {
        if !dir.is_empty() {
            buf.push(dir);
        }
    }
    buf.push(name);

    if let Ok(()) = std::fs::write(buf.as_path(), data) {
        Ok(())
    } else {
        Err(FileError::FailedToWrite)
    }
}

#[command]
fn dir_create(name: String, dir: String) -> Result<String, FileError> {
    let mut buf = PathBuf::new();
    buf.push(dir);
    buf.push(name);

    if let Ok(()) = std::fs::create_dir_all(buf.as_path()) {
        Ok(buf.as_path().to_string_lossy().into_owned())
    } else {
        Err(FileError::FailedToCreate)
    }
}

#[command]
fn template_file_exists(name: String, folder: String, dir: String) -> Result<bool, FileError> {
    let mut buf = PathBuf::new();
    buf.push(dir);
    if folder != "/" {
        buf.push(&folder[1..]);
    }
    buf.push(name);
    buf.try_exists().or_else(|_e| Err(FileError::FileNotFound))
}

#[command]
fn template_file_read(name: String, folder: String, dir: String) -> Result<String, FileError> {
    let mut buf = PathBuf::new();
    buf.push(dir);
    if folder != "/" {
        buf.push(&folder[1..]);
    }
    buf.push(name);

    if let Ok(data) = std::fs::read_to_string(buf.as_path()) {
        Ok(data)
    } else {
        Err(FileError::FileNotFound)
    }
}

fn get_now() -> u64 {
    match SystemTime::now().duration_since(SystemTime::UNIX_EPOCH) {
        Ok(dur) => dur.as_secs(),
        Err(_) => 0,
    }
}

#[derive(Debug, serde::Serialize)]
struct DirData {
    entries: Vec<TemplateDirEntry>,
    last_read: u64,
}

#[derive(Debug, serde::Serialize)]
struct TemplateDirEntry {
    name: String,
    data: Option<String>,
}

#[command]
fn template_dir_read(folder: String, dir: String) -> Result<DirData, FileError> {
    let mut buf = PathBuf::new();
    buf.push(dir);
    if folder != "/" {
        buf.push(&folder[1..]);
    }

    if !buf.is_dir() {
        return Err(FileError::FileNotFound);
    }
    if let Ok(r) = std::fs::read_dir(buf.as_path()) {
        let mut names: Vec<TemplateDirEntry> = r.filter_map(|entry| {
            if let Ok(entry) = entry {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_file() {
                        if let Ok(data) = std::fs::read_to_string(entry.path()) {
                            return Some(TemplateDirEntry {
                                name: entry.file_name().to_string_lossy().into_owned(),
                                data: Some(data),
                            });
                        }
                    }
                }
            }
            None
        }).collect();
        names.sort_by(|a, b| sort_name(&a.name.as_str(), &b.name.as_str()));
        return Ok(DirData { entries: names, last_read: get_now() });
    }
    Err(FileError::FileNotFound)
}

#[command]
fn template_dir_reload(folder: String, dir: String, last_read: u64) -> Result<DirData, FileError> {
    let mut buf = PathBuf::new();
    buf.push(dir);
    if folder != "/" {
        buf.push(&folder[1..]);
    }

    if !buf.is_dir() {
        return Err(FileError::FileNotFound);
    }

    let last_checked = SystemTime::UNIX_EPOCH.checked_add(Duration::from_secs(last_read)).unwrap();
    if let Ok(r) = std::fs::read_dir(buf.as_path()) {
        let names: Vec<TemplateDirEntry> = r.filter_map(|entry| {
            if let Ok(entry) = entry {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_file() {
                        let is_modified = metadata.modified().map_or(true, |v| {
                            v > last_checked
                        });
                        if is_modified {
                            if let Ok(data) = std::fs::read_to_string(entry.path()) {
                                return Some(TemplateDirEntry {
                                    name: entry.file_name().to_string_lossy().into_owned(),
                                    data: Some(data),
                                });
                            }
                        }
                    }
                }
            }
            None
        }).collect();
        return Ok(DirData { entries: names, last_read: get_now() });
    }

    Err(FileError::FileNotFound)
}

#[command]
fn template_dir_remove(folder: String, dir: String) -> Result<(), FileError> {
    let mut buf = PathBuf::new();
    buf.push(dir);
    if folder != "/" {
        buf.push(&folder[1..]);
    }

    if !buf.is_dir() {
        return Err(FileError::FileNotFound);
    }

    std::fs::remove_dir_all(buf.as_path()).map_or_else(
        |_| Err(FileError::FileNotFound),
        |_| Ok(())
    )
}

#[command]
fn template_file_write(name: String, folder: String, dir: String, data: String) -> Result<(), FileError> {
    let mut buf = PathBuf::new();
    buf.push(dir);
    if folder != "/" {
        buf.push(&folder[1..]);
    }
    let _ = std::fs::create_dir_all(buf.as_path()).is_ok();
    buf.push(name);

    if let Ok(()) = std::fs::write(buf.as_path(), data) {
        Ok(())
    } else {
        Err(FileError::FailedToWrite)
    }
}

#[command]
fn template_file_rename(name: String, folder: String, dir: String, new_name: String) -> Result<(), FileError> {
    let mut buf = PathBuf::new();
    buf.push(dir);
    if folder != "/" {
        buf.push(&folder[1..]);
    }
    let mut new_buf = buf.clone();
    new_buf.push(new_name);
    buf.push(name);

    if let Ok(()) = std::fs::rename(buf.as_path(), new_buf.as_path()) {
        Ok(())
    } else {
        Err(FileError::FileNotFound)
    }
}

#[command]
fn template_file_remove(name: String, folder: String, dir: String) -> Result<(), FileError> {
    let mut buf = PathBuf::new();
    buf.push(dir);
    if folder != "/" {
        buf.push(&folder[1..]);
    }
    buf.push(name);

    if let Ok(()) = std::fs::remove_file(buf.as_path()) {
        Ok(())
    } else {
        Err(FileError::FileNotFound)
    }
}

#[command]
fn template_file_copy(name: String, folder: String, dir: String, another: String) -> Result<String, FileError> {
    let mut buf = PathBuf::new();
    buf.push(dir);
    if folder != "/" {
        buf.push(&folder[1..]);
    }
    let mut another_buf = buf.clone();
    another_buf.push(another);
    buf.push(name);

    if let Ok(_) = std::fs::copy(buf.as_path(), another_buf.as_path()) {
        Ok(another_buf.as_path().to_string_lossy().into_owned())
    } else {
        Err(FileError::FileNotFound)
    }
}

#[derive(Debug, serde::Serialize)]
struct FileEntries {
    path: String,
    name: String,
    folder: String,
}

#[command]
fn template_dir_list(folder: String, dir: String) -> Result<Vec<String>, FileError> {
    let mut buf = PathBuf::new();
    buf.push(dir);
    if folder != "/" {
        buf.push(&folder[1..]);
    }

    if buf.is_dir() {
        if let Ok(r) = std::fs::read_dir(buf.as_path()) {
            let mut names: Vec<String> = r.filter_map(|entry| {
                if let Ok(entry) = entry {
                    if let Ok(metadata) = entry.metadata() {
                        if metadata.is_file() {
                            return Some(entry.file_name().to_string_lossy().into_owned());
                        }
                    }
                }
                None
            }).collect();
            names.sort_by(|a, b| sort_name(&a.as_str(), &b.as_str()));
            return Ok(names);
        }
    }
    Err(FileError::FileNotFound)
}

fn list_folders(folders: &mut Vec<String>, path: &Path, base: &str) {
    if path.is_dir() {
        if let Ok(r) = std::fs::read_dir(path) {
            for entry in r {
                if let Ok(entry) = entry {
                    if let Ok(metadata) = entry.metadata() {
                        if metadata.is_dir() {
                            let mut folder = String::from(base);
                            folder.push_str(&entry.file_name().to_string_lossy());
                            let mut folder_ = folder.clone();
                            folder_.push('/');
                            folders.push(folder);

                            list_folders(folders, &entry.path().as_path(), &folder_);
                        }
                    }
                }
            }
        }
    }
}

#[command]
fn template_list_folders(dir: String) -> Result<Vec<String>, FileError> {
    let mut buf = PathBuf::new();
    buf.push(dir);

    let mut folders = Vec::new();
    folders.push(String::from("/"));

    list_folders(&mut folders, &buf.as_path(), "/");

    Ok(folders)
}

#[command]
fn template_dir_clear(dir: String) -> Result<(), FileError> {
    let mut buf = PathBuf::new();
    buf.push(dir);

    if let Ok(()) = std::fs::remove_dir_all(buf.as_path()) {
        if let Ok(()) = std::fs::create_dir_all(buf.as_path()) {
            return Ok(());
        }
    }
    Err(FileError::FileNotFound)
}

#[derive(Debug, serde::Serialize)]
struct Entry {
    path: String,
    hash: String,
}

fn list_hash(entries: &mut Vec<Entry>, path: &Path) {
    if let Ok(reader) = std::fs::read_dir(path) {
        let mut hasher = Sha1::new();
        for r in reader {
            if let Ok(entry) = r {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_dir() {
                        list_hash(entries, &entry.path());
                    } else {
                        if let Ok(data) = std::fs::read_to_string(entry.path()) {
                            hasher.update(data.as_bytes());
                            let result = hasher.finalize_reset();
                            let mut digest = String::with_capacity(40);
                            for v in result {
                                write!(digest, "{:02x}", v).expect("");
                            }
                            entries.push(Entry{
                                path: entry.path().to_string_lossy().into(),
                                hash: digest,
                            });
                        }
                    }
                }
            }
        }
    }
}

#[command]
fn template_list_hash(dir: String) -> Vec<Entry> {
    let mut buf = PathBuf::new();
    buf.push(dir);

    let mut entries = Vec::new();

    list_hash(&mut entries, buf.as_path());

    entries
}

#[derive(Debug, Default, serde::Serialize, serde::Deserialize)]
struct PosSize {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

impl PosSize {
    pub fn to_physical_position(&self) -> PhysicalPosition<i32> {
        PhysicalPosition::new(self.x, self.y)
    }

    pub fn to_physical_size(&self) -> PhysicalSize<u32> {
        PhysicalSize::new(self.width, self.height)
    }
}

fn load_window_settings(path: &Path) -> Option<PosSize> {
    if let Ok(s) = std::fs::read_to_string(path) {
        if let Ok(possize) = serde_json::from_str(&s) {
            return Some(possize);
        }
    }
    None
}

fn store_window_settings(path: &Path, position: tauri::PhysicalPosition<i32>, size: tauri::PhysicalSize<u32>) -> std::io::Result<()> {
    let possize = PosSize {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    };
    if let Ok(s) = serde_json::to_string(&possize) {
        std::fs::write(path, s)
    } else {
        Err(std::io::Error::new(std::io::ErrorKind::Other, ""))
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            print_string,
            file_read,
            file_write,
            file_read_binary,
            file_write_binary,
            dir_create,
            template_file_exists,
            template_file_read,
            template_file_write,
            template_file_rename,
            template_file_remove,
            template_file_copy,
            template_list_folders,
            template_list_hash,
            template_dir_list,
            template_dir_clear,
            template_dir_read,
            template_dir_reload,
            template_dir_remove,
        ])
        .setup(|app| {
            const WINDOW_SETTINGS: &str = "window.json";
            const LABEL: &str = "main";

            let window = app.get_window(LABEL).unwrap();

            // restore position and size
            let resolver = app.path_resolver();
            if let Some(mut buf) = resolver.app_config_dir() {
                let _ = std::fs::create_dir_all(buf.as_path()).is_ok();
                buf.push(WINDOW_SETTINGS);
                if let Some(possize) = load_window_settings(&buf.as_path()) {
                    let _ = window.set_position(possize.to_physical_position()).is_ok();
                    let _ = window.set_size(possize.to_physical_size()).is_ok();
                }
            }

            window.show()?;

            let window_ = window.clone();
            window.on_window_event(move |event| {
                match event {
                    tauri::WindowEvent::CloseRequested{ .. } => {
                        if let (Ok(position), Ok(size)) =
                            (window_.outer_position(), window_.outer_size()) {
                            if let Some(mut buf) = resolver.app_config_dir() {
                                buf.push(WINDOW_SETTINGS);

                                let _ = store_window_settings(buf.as_path(), position, size).is_ok();
                            }
                        }
                    }
                    _ => {}
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

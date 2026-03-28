use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    opener::open(&path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
    Migration {
      version: 1,
      description: "create_initial_tables",
      sql: "
      CREATE TABLE IF NOT EXISTS subjects(id TEXT PRIMARY KEY, name TEXT, cover_path TEXT NULL, pinned INT, created_at TEXT, last_studied_at TEXT NULL, total_minutes INT);
      CREATE TABLE IF NOT EXISTS tags(id TEXT PRIMARY KEY, name TEXT UNIQUE);
      CREATE TABLE IF NOT EXISTS subject_tags(subject_id TEXT, tag_id TEXT, PRIMARY KEY(subject_id, tag_id), FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE, FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS subgoals(id TEXT PRIMARY KEY, subject_id TEXT, text TEXT, done INT, created_at TEXT, FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, started_at TEXT, ended_at TEXT NULL, template TEXT, repeats INT, planned_minutes INT, actual_minutes INT);
      CREATE TABLE IF NOT EXISTS session_blocks(id TEXT PRIMARY KEY, session_id TEXT, idx INT, type TEXT, minutes INT, subject_id TEXT NULL, technique_id TEXT NULL, started_at TEXT NULL, ended_at TEXT NULL, FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE);
      ",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 2,
      description: "create_quotes_table",
      sql: "
      CREATE TABLE IF NOT EXISTS quotes(id TEXT PRIMARY KEY, text TEXT NOT NULL, idx INT NOT NULL DEFAULT 0);
      INSERT OR IGNORE INTO quotes(id, text, idx) VALUES ('default_1', 'Let''s do our best today! ✨', 0);
      INSERT OR IGNORE INTO quotes(id, text, idx) VALUES ('default_2', 'You''re doing amazing! 💖', 1);
      INSERT OR IGNORE INTO quotes(id, text, idx) VALUES ('default_3', 'Keep going, you got this! 🌟', 2);
      INSERT OR IGNORE INTO quotes(id, text, idx) VALUES ('default_4', 'Every minute counts! ⏰', 3);
      ",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 3,
      description: "create_mechanic_logs_table",
      sql: "
      CREATE TABLE IF NOT EXISTS mechanic_logs(
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        retention TEXT,
        focus_drop TEXT,
        memorization_align TEXT,
        mechanical_fix TEXT
      );
      ",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 4,
      description: "migrate_to_metacognition_logs",
      sql: "
      DROP TABLE IF EXISTS mechanic_logs;
      CREATE TABLE IF NOT EXISTS metacognition_logs(
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        retention TEXT,
        focus_drop TEXT,
        memorization_align TEXT,
        mechanical_fix TEXT
      );
      ",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 5,
      description: "add_deadline_and_archived_to_subjects",
      sql: "
      ALTER TABLE subjects ADD COLUMN deadline TEXT NULL;
      ALTER TABLE subjects ADD COLUMN archived INT DEFAULT 0;
      ",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 6,
      description: "add_focus_type_and_chapters_to_subjects",
      sql: "
      ALTER TABLE subjects ADD COLUMN focus_type TEXT NULL;
      ALTER TABLE subjects ADD COLUMN chapters TEXT NULL;
      ",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 7,
      description: "add_result_to_subjects",
      sql: "
      ALTER TABLE subjects ADD COLUMN result TEXT NULL;
      ",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 8,
      description: "add_deleted_at_to_subjects",
      sql: "
      ALTER TABLE subjects ADD COLUMN deleted_at TEXT NULL;
      ",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 9,
      description: "add_subject_type_to_subjects",
      sql: "
      ALTER TABLE subjects ADD COLUMN subject_type TEXT NULL;
      ",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 10,
      description: "add_free_time_and_priority_to_metacognition_logs",
      sql: "
      ALTER TABLE metacognition_logs ADD COLUMN free_time_hours REAL NULL;
      ALTER TABLE metacognition_logs ADD COLUMN priority_subject_ids TEXT NULL;
      ",
      kind: MigrationKind::Up,
    }
  ];

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_path])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:study_buddy.db", migrations)
                .build(),
        )
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

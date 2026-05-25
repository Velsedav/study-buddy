// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  #[cfg(target_os = "linux")]
  {
    // XWayland backend — more mature GPU compositing path than native Wayland
    std::env::set_var("GDK_BACKEND", "x11");
    // Disable buggy DMA-BUF buffer sharing that causes white screens on WebKitGTK
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    // Nvidia: enable multi-threaded GL driver optimizations (reduces frame time)
    std::env::set_var("__GL_THREADED_OPTIMIZATIONS", "1");
    // Force GTK to use the GL renderer instead of ngl/Vulkan (better WebKitGTK compat)
    std::env::set_var("GSK_RENDERER", "gl");
  }

  app_lib::run();
}

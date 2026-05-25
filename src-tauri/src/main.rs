// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // Fix WebKitGTK white-screen bug on Linux (Debian 13 / GNOME Wayland).
  // GDK_BACKEND=x11: route through XWayland for more mature GPU compositing.
  // WEBKIT_DISABLE_DMABUF_RENDERER: disable the buggy DMA-BUF buffer sharing
  // that causes white screens on both Wayland and X11 with newer WebKitGTK.
  #[cfg(target_os = "linux")]
  {
    std::env::set_var("GDK_BACKEND", "x11");
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
  }

  app_lib::run();
}

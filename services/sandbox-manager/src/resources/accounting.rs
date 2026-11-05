use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ResourceUsage {
    pub user_time_ms: f64,
    pub system_time_ms: f64,
    pub wall_time_ms: f64,
    pub peak_rss_bytes: u64,
    pub minor_page_faults: u64,
    pub major_page_faults: u64,
}

impl ResourceUsage {
    /// Captures resource accounting for reaped child processes via `getrusage(RUSAGE_CHILDREN)`.
    pub fn capture_children(wall_time_ms: f64) -> Self {
        let mut usage: libc::rusage = unsafe { std::mem::zeroed() };
        let ret = unsafe { libc::getrusage(libc::RUSAGE_CHILDREN, &mut usage) };

        if ret == 0 {
            let u_ms = (usage.ru_utime.tv_sec as f64 * 1000.0) + (usage.ru_utime.tv_usec as f64 / 1000.0);
            let s_ms = (usage.ru_stime.tv_sec as f64 * 1000.0) + (usage.ru_stime.tv_usec as f64 / 1000.0);
            // On Linux ru_maxrss is in kilobytes
            let rss_bytes = (usage.ru_maxrss as u64) * 1024;

            Self {
                user_time_ms: u_ms,
                system_time_ms: s_ms,
                wall_time_ms,
                peak_rss_bytes: rss_bytes,
                minor_page_faults: usage.ru_minflt as u64,
                major_page_faults: usage.ru_majflt as u64,
            }
        } else {
            Self {
                wall_time_ms,
                ..Default::default()
            }
        }
    }
}

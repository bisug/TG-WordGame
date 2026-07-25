class MetricsRegistry {
  private updatesTotal = 0;
  private errorsTotal = 0;
  private totalDurationMs = 0;
  private durationCount = 0;

  incUpdates() {
    this.updatesTotal++;
  }

  incErrors() {
    this.errorsTotal++;
  }

  recordDuration(ms: number) {
    this.totalDurationMs += ms;
    this.durationCount++;
  }

  toPrometheusFormat(): string {
    const avgDurationSeconds =
      this.durationCount > 0
        ? (this.totalDurationMs / this.durationCount / 1000).toFixed(4)
        : 0;

    return [
      "# HELP tg_updates_total Total number of Telegram updates processed",
      "# TYPE tg_updates_total counter",
      `tg_updates_total ${this.updatesTotal}`,
      "",
      "# HELP tg_errors_total Total number of unhandled errors encountered",
      "# TYPE tg_errors_total counter",
      `tg_errors_total ${this.errorsTotal}`,
      "",
      "# HELP tg_update_duration_seconds_avg Average update processing time in seconds",
      "# TYPE tg_update_duration_seconds_avg gauge",
      `tg_update_duration_seconds_avg ${avgDurationSeconds}`,
    ].join("\n");
  }
}

export const metrics = new MetricsRegistry();

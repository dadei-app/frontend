export type BootstrapPhase =
  | 'booting'
  | 'checking_server'
  | 'checking_updates'
  | 'downloading'
  | 'install_pending'
  | 'manual_required'
  | 'ready'
  | 'mandatory_failed';

export interface BootstrapStatePayload {
  phase: BootstrapPhase;
  progress?: number;
  message?: string;
  downloadUrl?: string;
  serverVersion?: string;
  appVersion?: string;
}

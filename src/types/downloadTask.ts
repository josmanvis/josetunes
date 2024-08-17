export type downloadTask = {
  id: string;
  status: "pending" | "downloading" | "completed" | "failed";
  url: string;
  format: string;
  youtubeId: string | null;
  soundcloudId: string | null;
};

import { createContext, createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/tauri";
import { downloadTask } from "../types";

export const AppStateContext = createContext();

export const AppStateProvider = (props: any) => {
  // UI only state, simple silly notice of the footnote
  const [displayFootnote, _displayFootnote] = createSignal<boolean>(true);
  // TODO: needs to be reworked after the switch to batch downloads
  const [currentlyDownloading, _currentlyDownloading] = createSignal(false);
  // This is the format of the audio file (nextURL) to download
  const [format, _format] = createSignal<string | null>("flac");
  // This is the buffer string from the input field in the toolbar
  const [nextURL, _nextURL] = createSignal<string | null>(null);
  const [downloadError, _downloadError] = createSignal<string | null>(null);
  const [downloadList, _downloadList] = createSignal<downloadTask[]>([]);

  const addToDownloadList = (task: downloadTask) => {
    let id = String(Math.floor(Math.random() * 9000000000) + 1000000000);
    // If its a youtube url, extract the youtube video id
    let youtubeId = null;
    youtubeId =
      task.url.match(/(?:\?v=|&v=|youtu\.be\/)(.*?)(?:\?|&|$)/)?.[1] ?? null;

    // If its a soundcloud url, extract the soundcloud track id
    let soundcloudId = null;
    soundcloudId =
      task.url.match(/(?:soundcloud\.com\/)(.*?)(?:\?|&|$)/)?.[1] ?? null;

    _downloadList([
      ...downloadList(),
      { ...task, id, youtubeId, soundcloudId, status: "pending" },
    ]);
  };

  const removeFromDownloadList = (task: downloadTask) => {
    _downloadList(downloadList().filter((t) => t.id !== task.id));
  };

  const changeTaskStatus = (id: string, status: string) => {
    _downloadList(
      downloadList().map((task: any) => {
        if (task.id === id) {
          return { ...task, status };
        }
        return task;
      }),
    );
  };

  const startDownloadTask = async (task: downloadTask) => {
    _currentlyDownloading(true);
    changeTaskStatus(task.id, "downloading");
    setTimeout(async () => {
      try {
        const resp = await invoke("download_audio", {
          url: task.url,
          format: task.format,
        });
        console.log("Downloaded Successfully", resp);
        changeTaskStatus(task.id, "completed");
        _currentlyDownloading(false);
      } catch (error) {
        console.error("Download failed", error);
        changeTaskStatus(task.id, "failed");
        _currentlyDownloading(false);
      }
    }, 200);
  };

  const startAllDownloadTasks = async () => {
    downloadList().forEach((task) => {
      startDownloadTask(task);
    });
  };

  // test
  // https://www.youtube.com/watch?v=m4_9TFeMfJE

  //  Global State Context
  const contextValue = {
    // state mgmt
    displayFootnote,
    _displayFootnote,
    currentlyDownloading,
    _currentlyDownloading,
    format,
    _format,
    nextURL,
    _nextURL,
    downloadList,
    // utils
    startDownloadTask,
    startAllDownloadTasks,
    changeTaskStatus,
    addToDownloadList,
    removeFromDownloadList,
  };

  return (
    <AppStateContext.Provider value={contextValue}>
      {props.children}
    </AppStateContext.Provider>
  );
};

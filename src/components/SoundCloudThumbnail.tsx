import { onMount, createSignal } from "solid-js";
import "./SoundCloudThumbnail.scss";
import { invoke } from "@tauri-apps/api/tauri";

function SoundCloudThumbnail({ url }: { url: string }) {
  const [artworkUrl, _artworkUrl] = createSignal<string | null>(null);
  // fetch_artwork_html
  onMount(() => {
    invoke("fetch_artwork_html", {
      url,
    }).then((res: any) => {
      let art = JSON.parse(res).urls[0] || null;
      console.log(art);
      _artworkUrl(art);
    });
  });
  return (
    <div class="sound-cloud-thumbnail">
      {artworkUrl() && <img src={artworkUrl() ?? ""} />}
    </div>
  );
}

export default SoundCloudThumbnail;

import "./YouTubeThumbnail.scss";

const YouTubeThumbnail = ({ id }: { id: string }) => {
  return (
    <div class="you-tube-thumbnail">
      <img src={`https://i3.ytimg.com/vi/${id}/maxresdefault.jpg`} />
    </div>
  );
};

export default YouTubeThumbnail;

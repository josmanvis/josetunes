import "./DownloadList.scss";

const DownloadList = (props: any) => {
  return (
    <div
      data-name={props.name ? props.name : null}
      class={"download-list" + (props.class ? " " + props.class : "")}
      style={props.style ? props.style : null}
    >
      <ul>{props.children}</ul>
    </div>
  );
};

export default DownloadList;

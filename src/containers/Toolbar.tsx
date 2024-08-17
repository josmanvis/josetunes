import "./Toolbar.scss";

const Toolbar = (props:any) => {
 return <div data-name={props.name ? props.name : null} class={"toolbar" + (props.class ? (" " + props.class) : "")} style={props.style ? props.style : null}>
    {props.children}
  </div>
}

export default Toolbar;

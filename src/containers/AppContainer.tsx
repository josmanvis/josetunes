import "./AppContainer.scss";

const AppContainer = (props:any) => {
 return <div data-name={props.name ? props.name : null} class={"app-container" + (props.class ? (" " + props.class) : "")} style={props.style ? props.style : null}>
    {props.children}
  </div>
}

export default AppContainer;

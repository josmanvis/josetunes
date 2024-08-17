import { useContext } from "solid-js";
import "./Footnote.scss";
import { AppStateContext } from "../contexts/app-state";

const Footnote = () => {
  const { _displayFootnote } = useContext<any>(AppStateContext);
  return (
    <div class="footnote">
      <button class="close" onClick={() => _displayFootnote(false)}>
        x
      </button>
      <small>
        “Esta aplicación es una maravilla… digo, una mierda, pero ¡funciona!
        <br /> La empecé a escribir en la barra después de unas cuantas (4, 5…
        6, 7, 8) cervecitas,
        <br /> y por fin salió algo. Espero que les sirva; si no, ¿a quién le
        importa?
        <br /> ¡Esta mierda es gratis para todos! One love 🫶”
      </small>
    </div>
  );
};

export default Footnote;

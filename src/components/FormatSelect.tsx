import { useContext } from "solid-js";
import "./FormatSelect.scss";
import { AppStateContext } from "../contexts/app-state";

const FormatSelect = () => {
  const { format, _format } = useContext<any>(AppStateContext);
  return (
    <div class="format-select">
      <select onChange={(e) => _format(e.currentTarget.value)}>
        <option value="flac">.flac</option>
        <option value="mp3">.mp3</option>
      </select>
    </div>
  );
};

export default FormatSelect;

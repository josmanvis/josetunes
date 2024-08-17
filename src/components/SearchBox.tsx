import { useContext } from "solid-js";
import { AppStateContext } from "../contexts/app-state";
import "./SearchBox.scss";

const SearchBox = () => {
  const { _nextURL } = useContext<any>(AppStateContext);
  return (
    <div class="search-box">
      <input
        type="text"
        placeholder="paste any url here"
        onKeyUp={(e) => _nextURL(e.currentTarget.value)}
      />
    </div>
  );
};

export default SearchBox;

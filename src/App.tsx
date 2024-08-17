import { useContext } from "solid-js";
import "./resets.scss";
import "./App.css";
import "./theme.scss";
import Footnote from "./components/Footnote";
import SearchBox from "./components/SearchBox";
import AppContainer from "./containers/AppContainer";
import Toolbar from "./containers/Toolbar";
import { AppStateContext, AppStateProvider } from "./contexts/app-state";
import FormatSelect from "./components/FormatSelect";
import CTAButton from "./components/CTAButton";
import DownloadList from "./containers/DownloadList";
import ListItem from "./components/ListItem";
import { downloadTask } from "./types";
import DownloadingScreen from "./components/DownloadingScreen";
import { DownloadIcon } from "./icons/DownloadIcon";

function App() {
  // let currentlyDownloading = () => true;
  const {
    addToDownloadList,
    currentlyDownloading,
    downloadList,
    nextURL,
    format,
    startAllDownloadTasks,
    displayFootnote,
  } = useContext<any>(AppStateContext);
  return (
    <AppContainer>
      {currentlyDownloading() ? (
        <DownloadingScreen />
      ) : (
        <>
          <Toolbar>
            <SearchBox />
            <FormatSelect />
            <CTAButton
              handleClick={() =>
                addToDownloadList({
                  url: nextURL(),
                  format: format(),
                })
              }
              label="add"
            />
          </Toolbar>
          {console.log("downloadList", downloadList())}
          <DownloadList>
            {downloadList().map((_: downloadTask) => (
              <ListItem task={_} />
            ))}
          </DownloadList>
          <CTAButton
            label="download all"
            handleClick={() => startAllDownloadTasks()}
          >
            <DownloadIcon />
          </CTAButton>
        </>
      )}

      {displayFootnote() && <Footnote />}
    </AppContainer>
  );
}

export default (props: any) => (
  <AppStateProvider>
    <App {...props} />
  </AppStateProvider>
);

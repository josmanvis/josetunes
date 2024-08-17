import { createContext } from "solid-js";

export const ThemeProviderContext = createContext();

export const ThemeProviderProvider = (props: any) => {
  //  Global State Context
  const contextValue = {};

  return (
    <ThemeProviderContext.Provider value={contextValue}>
      {props.children}
    </ThemeProviderContext.Provider>
  );
};

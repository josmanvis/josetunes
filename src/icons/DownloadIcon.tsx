export const DownloadIcon = ({ color = "white" }: { color?: string }) => (
  <svg
    width="24px"
    height="24px"
    stroke-width="1.5"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    color={color}
  >
    <path
      d="M6 20L18 20"
      stroke={color}
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    ></path>
    <path
      d="M12 4V16M12 16L15.5 12.5M12 16L8.5 12.5"
      stroke={color}
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    ></path>
  </svg>
);

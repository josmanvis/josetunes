import "./CTAButton.scss";

const CTAButton = ({
  handleClick,
  label,
  children,
}: {
  children?: any;
  handleClick: any;
  label: string;
}) => {
  return (
    <div class="cta-button">
      <button onClick={handleClick}>
        {children}
        {label}
      </button>
    </div>
  );
};

export default CTAButton;

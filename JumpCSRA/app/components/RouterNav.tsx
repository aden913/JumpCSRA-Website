import { Link } from "react-router";

type RouterNavProps = {
  onNavClick?: (type: string) => void;
};

export function RouterNav({ onNavClick }: RouterNavProps) {
  return (
    <nav className="nav-bar">
      <ul>
        <Link to="/" style={{ display: "inline-block" }}>
          <img src="/favicon.ico" alt="JumpCSRA Logo" className="nav-logo" />
        </Link>
        <li>
          <button type="button" className="nav-btn" onClick={() => onNavClick && onNavClick("Bounce House")}>Bounce House</button>
        </li>
        <li>
          <button type="button" className="nav-btn" onClick={() => onNavClick && onNavClick("Water Slide")}>Water Slide</button>
        </li>
        <li>
          <button type="button" className="nav-btn" onClick={() => onNavClick && onNavClick("Obstacle Course")}>Obstacle Course</button>
        </li>
        <li>
          <button type="button" className="nav-btn" onClick={() => onNavClick && onNavClick("Games")}>Games</button>
        </li>
      </ul>
    </nav>
  );
}

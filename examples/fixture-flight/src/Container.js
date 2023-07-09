// Using CSS Modules in shared components
import classes from "./Container.module.css";
// Using global CSS in shared components
import "./Container.css";

export default function Container({ children }) {
	return <div className={`${classes.container} bold`}>{children}</div>;
}

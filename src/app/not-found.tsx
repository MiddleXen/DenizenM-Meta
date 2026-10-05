import Link from 'next/link';

export default function NotFound() {
  return (
    <span className="center_helper">
      <div className="jumbotron">
        <h1>404: Page Not Found</h1>
        <br />
        <br />
        <h4>The URL you gave was not valid. Check your spelling!</h4>
        <br />
        <h5>
          Return to the <Link href="/">Homepage</Link>.
        </h5>
      </div>
    </span>
  );
}

Welcome to your new TanStack Start app!

# Getting Started

To run this application:

```bash
npm install
npm run dev
```

# Building For Production

To build this application for production:

```bash
npm run build
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
npm run test
```

## Bluesky Directory scraper

Scrapes [Bluesky Directory](https://blueskydirectory.com/) product pages (icon, screenshots, tagline, description), resolves the **Visit** link (`…/out` on the directory) to the real **external** URL via HTTP redirects, and optionally classifies each listing with a structured taxonomy in `scripts/scrape-bluesky-directory/taxonomy.ts`.

```bash
# Set ANTHROPIC_API_KEY or ANTHROPIC_KEY in .env (or the environment)

npm run scrape:bluesky -- --dry-run --max-products 5
npm run scrape:bluesky -- --max-products 20 --output out/bluesky-directory-scrape.json
```

The output file is a JSON array that is **updated after each product** (closing `]` is written when the run finishes or exits normally). Listing pages often only ship page-one products in server HTML; the CLI defaults to `--follow-related` so additional products are discovered via related-product links. Use `--no-follow-related` to only process URLs found on listing pages.

**Coverage:** The directory UI may show a total count (e.g. 342 products on the home grid). This scraper only sees URLs present in **fetched HTML**. Unions of page-one listing pages across all browse categories currently surface **339** unique product URLs; a few listings exist only on **page 2+**, which is loaded with **Livewire in the browser**, so they do not appear in static HTML and may be missing unless they appear as “related” links from another product. Raising `--max-visits` does not fix that gap.

To **backfill** `visitOutUrl` and `externalUrl` on an existing scrape file (no LLM calls): rows that already have `externalUrl` are skipped unless you pass `--force`. Each HTTP resolve uses a 30s timeout.

```bash
npm run backfill:bluesky-external-urls -- --input out/bluesky-directory-scrape.json
```

## Database

This project is set up for Postgres with [Drizzle ORM](https://orm.drizzle.team/) and the `postgres` driver.

1. Copy `.env.example` to `.env`
2. Set `DATABASE_URL`
3. Generate a migration with `npm run db:generate`
4. Apply it with `npm run db:migrate`

The starter schema lives in `src/db/schema.ts`, and the server-side Drizzle client is exported from `src/db/index.server.ts`.

This setup also includes `pgvector` support:

1. Make sure your Postgres instance supports the `vector` extension
2. Change `EMBEDDING_DIMENSIONS` in `src/db/schema.ts` if your embedding model uses a different size
3. Run `npm run db:migrate` to create the extension, embedding table, and indexes

The `embeddings` table includes a `vector(...)` column and an `hnsw` cosine index for similarity search.

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Uninstall the packages: `npm install @tailwindcss/vite tailwindcss -D`

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "My App" },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
});
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from "@tanstack/react-start";

const getServerTime = createServerFn({
  method: "GET",
}).handler(async () => {
  return new Date().toISOString();
});

// Use in a component
function MyComponent() {
  const [time, setTime] = useState("");

  useEffect(() => {
    getServerTime().then(setTime);
  }, []);

  return <div>Server time: {time}</div>;
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";

export const Route = createFileRoute("/api/hello")({
  server: {
    handlers: {
      GET: () => json({ message: "Hello, World!" }),
    },
  },
});
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/people")({
  loader: async () => {
    const response = await fetch("https://swapi.dev/api/people");
    return response.json();
  },
  component: PeopleComponent,
});

function PeopleComponent() {
  const data = Route.useLoaderData();
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  );
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).

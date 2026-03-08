require('dotenv').config({
  path: `.env.${process.env.NODE_ENV || 'production'}`
});

const wrapESMPlugin = (name) =>
  function wrapESM(opts) {
    return async (...args) => {
      const mod = await import(name);
      const plugin = mod.default(opts);
      return plugin(...args);
    };
  };

module.exports = {
  // pathPrefix is only applied when PREFIX_PATHS=true (GitHub Actions / GitHub Pages).
  // Netlify deploys serve from root so no prefix is needed there.
  ...(process.env.PREFIX_PATHS === 'true' ? { pathPrefix: '/z0rs.github.io' } : {}),
  // flags: {
  //   FAST_DEV: true
  // },
  trailingSlash: 'always',
  siteMetadata: {
    name: 'Eno Leriand',
    description: 'Security & Research',
    keywords: [
      'React',
      'Gatsby',
      'JavaScript',
      'TypeScript',
      'Flow',
      'Styled Components',
      'Theme UI',
      'Tailwind',
      'Jest',
      'Enzyme',
      'React Testing Libary',
      'Node.js',
      'Fauna',
      'Jamstack',
      'Component Library',
      'Serverless Functions'
    ],
    siteUrl: process.env.URL,
    defaultImage: '/images/76135196.jpeg'
  },
  plugins: [
    'gatsby-plugin-gatsby-cloud',
    'gatsby-plugin-image',
    'gatsby-transformer-sharp',
    'gatsby-plugin-postcss',
    'gatsby-transformer-json',
    'gatsby-plugin-sitemap',
    {
      resolve: 'gatsby-plugin-mdx',
      options: {
        mdxOptions: {
          // remark-gfm enables GitHub Flavored Markdown: tables, strikethrough,
          // task lists, etc. MDX v2 does NOT include GFM by default (unlike MDX v1),
          // so pipe tables in .mdx files require this plugin to render correctly.
          remarkPlugins: [wrapESMPlugin('remark-gfm')],
          rehypePlugins: [wrapESMPlugin('rehype-slug'), [wrapESMPlugin('rehype-autolink-headings'), { behavior: 'wrap' }]]
        }
      }
    },
    {
      resolve: 'gatsby-plugin-sharp',
      options: {
        defaults: {
          quality: 70,
          formats: ['auto', 'webp'],
          placeholder: 'blurred'
        }
      }
    },
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        path: `${__dirname}/content/pages/`
      }
    },
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        path: `${__dirname}/content/articles/`
      }
    },
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        path: `${__dirname}/content/ctfs/`
      }
    }
  ],
  partytownProxiedURLs: [`https://www.googletagmanager.com/gtag/js?id=${process.env.GATSBY_GA_MEASUREMENT_ID}`]
};

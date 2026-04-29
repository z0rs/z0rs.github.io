import dotenv from 'dotenv';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import netlifyAdapterModule from 'gatsby-adapter-netlify';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config({
  path: `.env.${process.env.NODE_ENV || 'production'}`
});

const netlifyAdapter = netlifyAdapterModule.default || netlifyAdapterModule;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const canonicalSiteUrl =
  process.env.URL ||
  process.env.SITE_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://z0rs.github.io' : 'http://localhost:8000');

export default {
  adapter: netlifyAdapter({
    excludeDatastoreFromEngineFunction: true
  }),
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
    siteUrl: canonicalSiteUrl,
    defaultImage: '/images/76135196.jpeg'
  },
  plugins: [
    'gatsby-plugin-gatsby-cloud',
    'gatsby-plugin-image',
    'gatsby-transformer-sharp',
    'gatsby-plugin-postcss',
    {
      resolve: 'gatsby-plugin-sitemap',
      options: {
        excludes: ['/404/', '/404.html', '/dev-404-page/', '/offline-plugin-app-shell-fallback/']
      }
    },
    {
      resolve: 'gatsby-plugin-mdx',
      options: {
        extensions: ['.mdx', '.md'],
        mdxOptions: {
          remarkPlugins: [remarkGfm],
          rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'wrap' }]]
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

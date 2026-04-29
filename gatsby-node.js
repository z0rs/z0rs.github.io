const fs = require('fs');
const path = require('path');
const { createFilePath, createRemoteFileNode } = require('gatsby-source-filesystem');

// Block private/internal network targets to prevent SSRF via user-controlled frontmatter URLs.
function isAllowedUrl(url) {
  try {
    const { hostname, protocol } = new URL(url);
    if (!['http:', 'https:'].includes(protocol)) return false;
    const blocked = ['localhost', '127.0.0.1', '0.0.0.0'];
    if (blocked.includes(hostname)) return false;
    const isPrivate =
      /^10\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\.|^127\./.test(hostname) || hostname === '169.254.169.254'; // AWS metadata
    return !isPrivate;
  } catch {
    return false;
  }
}

function isLocalImagePath(value) {
  return typeof value === 'string' && /^\/images\/[a-z0-9/_\-.]+$/i.test(value.trim());
}

exports.createSchemaCustomization = async ({ actions: { createTypes } }) => {
  createTypes(`
    type Mdx implements Node @dontInfer {
      id: ID!
      body: String
      excerpt(pruneLength: Int = 140): String
      tableOfContents(maxDepth: Int): JSON
      frontmatter: MdxFrontmatter
      fields: MdxFields
      featuredImage: File @link(from: "fields.featuredImage")
      embeddedImages: [File] @link(from: "fields.embeddedImages")
      logo: File @link(from: "fields.logo")
    }

    type MdxFrontmatter @dontInfer {
      type: String
      title: String
      name: String
      icon: String
      tags: [String]
      url: String
      date: Date @dateformat(formatString: "MMMM DD, YYYY")
      dateModified: Date @dateformat(formatString: "MMMM DD, YYYY")
      author: String
      show: String
      role: String
      publication: String
      status: String
      isPrivate: Boolean
      pinned: Boolean
      logo: String
      featuredImage: String
      embeddedImages: [String]
    }

    type MdxFields @dontInfer {
      slug: String
      featuredImage: String
      embeddedImages: [String]
      logo: String
    }
  `);

  // Logs out all typeDefs
  // actions.printTypeDefinitions({ path: './typeDefs.txt' })
};

exports.sourceNodes = ({ actions: { createNode }, createNodeId, createContentDigest }) => {
  const packageJson = require('./package.json');

  createNode({
    ...packageJson,
    id: createNodeId(packageJson.version),
    internal: {
      type: 'packageJson',
      contentDigest: createContentDigest(packageJson)
    }
  });
};

exports.onCreateNode = async ({
  node,
  actions: { createNodeField, createNode },
  getNode,
  store,
  cache,
  createNodeId
}) => {
  if (node.internal.type === 'Mdx') {
    const rawPath = createFilePath({ node, getNode });
    // Sanitize the slug: replace characters that are invalid or problematic in URL paths.
    // & in a page path breaks Gatsby's static-query result lookup during SSR, causing
    // "The result of this StaticQuery could not be fetched" for those pages.
    const path = rawPath.replace(/&/g, '-and-').replace(/[%#?]/g, '-').replace(/-{2,}/g, '-');

    const {
      frontmatter: { type }
    } = node;

    await createNodeField({
      node,
      name: 'slug',
      value: type === 'page' ? path : type === 'opensource' ? `/${type}${path}` : `/${type}s${path}`
    });
  }

  if (node.internal.type === 'Mdx') {
    if (node.frontmatter.featuredImage && isAllowedUrl(node.frontmatter.featuredImage)) {
      try {
        let featuredImage = await createRemoteFileNode({
          url: node.frontmatter.featuredImage,
          parentNodeId: node.id,
          createNode,
          createNodeId,
          cache,
          store
        });
        if (featuredImage) {
          createNodeField({ node, name: 'featuredImage', value: featuredImage.id });
        }
      } catch (err) {
        console.warn(`[gatsby-node] Could not fetch featuredImage for "${node.frontmatter.title}": ${err.message}`);
        console.warn(`  URL: ${node.frontmatter.featuredImage}`);
      }
    } else if (isLocalImagePath(node.frontmatter.featuredImage)) {
      // Local static image path (e.g. /images/uploads/...) is allowed and rendered directly in UI.
    } else if (node.frontmatter.featuredImage) {
      console.warn(
        `[gatsby-node] Blocked SSRF attempt — invalid URL in featuredImage for "${node.frontmatter.title}": ${node.frontmatter.featuredImage}`
      );
    }

    if (node.frontmatter.embeddedImages) {
      const embeddedImages = await Promise.all(
        node.frontmatter.embeddedImages.map(async (url) => {
          if (!isAllowedUrl(url)) {
            console.warn(
              `[gatsby-node] Blocked SSRF attempt — invalid URL in embeddedImages for "${node.frontmatter.title}": ${url}`
            );
            return null;
          }
          try {
            return await createRemoteFileNode({
              url,
              parentNodeId: node.id,
              createNode,
              createNodeId,
              cache,
              store
            });
          } catch (err) {
            console.warn(`[gatsby-node] Could not fetch embeddedImage for "${node.frontmatter.title}": ${err.message}`);
            console.warn(`  URL: ${url}`);
            return null;
          }
        })
      );
      const validImages = embeddedImages.filter(Boolean);
      if (validImages.length > 0) {
        createNodeField({
          node,
          name: 'embeddedImages',
          value: validImages.map((embeddedImage) => embeddedImage.id)
        });
      }
    }

    if (node.frontmatter.logo && isAllowedUrl(node.frontmatter.logo)) {
      try {
        let logo = await createRemoteFileNode({
          url: node.frontmatter.logo,
          parentNodeId: node.id,
          createNode,
          createNodeId,
          cache,
          store
        });
        if (logo) {
          createNodeField({ node, name: 'logo', value: logo.id });
        }
      } catch (err) {
        console.warn(`[gatsby-node] Could not fetch logo for "${node.frontmatter.title}": ${err.message}`);
        console.warn(`  URL: ${node.frontmatter.logo}`);
      }
    } else if (node.frontmatter.logo) {
      console.warn(
        `[gatsby-node] Blocked SSRF attempt — invalid URL in logo for "${node.frontmatter.title}": ${node.frontmatter.logo}`
      );
    }
  }
};

exports.createPages = async ({ getNodesByType, actions: { createPage, createRedirect }, reporter }) => {
  // Skip creating the /write/ page on GitHub Pages — it has no server runtime and the
  // form would render but fail silently. The loader export alone doesn't prevent SSG HTML
  // generation, so we gate the page creation here instead.
  if (process.env.GATSBY_RUNTIME !== 'github') {
    createPage({
      path: '/write/',
      component: path.resolve('./src/write-page.js')
    });
  }

  const mdxNodes = getNodesByType('Mdx').filter((node) => node.frontmatter?.status !== 'draft');

  mdxNodes.forEach((node) => {
    const id = node.id;
    const contentFilePath = node.internal?.contentFilePath;
    const slug = node.fields?.slug;
    const type = node.frontmatter?.type;

    if (!id || !contentFilePath || !slug || !type) {
      reporter.warn(
        `[gatsby-node] Skipping MDX page creation for node "${
          id || 'unknown'
        }" due to missing slug/type/contentFilePath.`
      );
      return;
    }

    // gatsby-plugin-mdx v5 requires ?__contentFilePath=<absolute_path_to_mdx_file>
    // appended to the component path so Gatsby knows which MDX file to compile and
    // inject as the `children` prop into the template component.
    // Without this, `children` is undefined and the page renders blank.
    const template = path.join(__dirname, `./src/templates/${type}.js`);
    if (!fs.existsSync(template)) {
      reporter.warn(`[gatsby-node] Template not found for type "${type}" (node "${id}"): ${template}`);
      return;
    }

    createPage({
      path: slug,
      component: `${template}?__contentFilePath=${contentFilePath}`,
      context: {
        id: id
      },
      defer: false
    });
  });

  createRedirect({
    fromPath: '/writing/*',
    toPath: '/articles/*'
  });
};

const path = require('path');
const { createFilePath, createRemoteFileNode } = require('gatsby-source-filesystem');

exports.onCreateWebpackConfig = ({ actions }) => {
  actions.setWebpackConfig({
    ignoreWarnings: [
      {
        module: /chevrotain/ // this is ussed by @react-three/drei i think!
      }
    ]
  });
};

exports.createSchemaCustomization = async ({ actions: { createTypes } }) => {
  createTypes(`
    type Mdx implements Node {
      frontmatter: Frontmatter
      featuredImage: File @link(from: "fields.featuredImage")
      embeddedImages: [File] @link(from: "fields.embeddedImages")
      logo: File @link(from: "fields.logo")
    }
    type Frontmatter @dontInfer {
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
  if (node.internal.type === 'Mdx' || node.internal.type === 'PagesJson') {
    const path = createFilePath({ node, getNode });

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
    if (node.frontmatter.featuredImage) {
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
    }

    if (node.frontmatter.embeddedImages) {
      const embeddedImages = await Promise.all(
        node.frontmatter.embeddedImages.map(async (url) => {
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

    if (node.frontmatter.logo) {
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
    }
  }
};

exports.createPages = async ({ graphql, actions: { createPage, createRedirect } }) => {
  const {
    data: { allMdx }
  } = await graphql(`
    query {
      allMdx(filter: { frontmatter: { status: { ne: "draft" } } }) {
        nodes {
          id
          internal {
            contentFilePath
          }
          fields {
            slug
          }
          frontmatter {
            type
          }
        }
      }
    }
  `);

  allMdx.nodes.forEach((node) => {
    const {
      id,
      internal: { contentFilePath },
      fields: { slug },
      frontmatter: { type }
    } = node;

    // gatsby-plugin-mdx v5 requires ?__contentFilePath=<absolute_path_to_mdx_file>
    // appended to the component path so Gatsby knows which MDX file to compile and
    // inject as the `children` prop into the template component.
    // Without this, `children` is undefined and the page renders blank.
    const template = path.join(__dirname, `./src/templates/${type}.js`);

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

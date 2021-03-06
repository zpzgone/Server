/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import classnames from 'classnames';
import { MDXProvider } from '@mdx-js/react';
import useBaseUrl from '@docusaurus/useBaseUrl';

import Link from '@docusaurus/Link';
import MDXComponents from '@theme/MDXComponents';

import useInternalUser from '../../hooks/useInternalUser';

import styles from './styles.module.css';

function BlogPostItem(props) {
  const {
    children,
    frontMatter,
    metadata,
    truncated,
    isBlogPostPage = false,
  } = props;
  const { date, permalink, tags } = metadata;
  const { author, title } = frontMatter;
  const internalUser = useInternalUser(author);

  const authorURL =
    frontMatter.author_url || frontMatter.authorURL || internalUser?.url;
  const authorTitle =
    frontMatter.author_title || frontMatter.authorTitle || internalUser?.desc;
  const authorImageURL =
    frontMatter.author_image_url ||
    frontMatter.authorImageURL ||
    useBaseUrl(internalUser?.imageUrl);

  const renderPostHeader = () => {
    const TitleHeading = isBlogPostPage ? 'h1' : 'h2';
    const match = date.substring(0, 10).split('-');
    const year = match[0];
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);

    return (
      <header>
        <TitleHeading
          className={classnames('margin-bottom--sm', styles.blogPostTitle)}
        >
          {isBlogPostPage ? title : <Link to={permalink}>{title}</Link>}
        </TitleHeading>
        <div className="margin-vert--md">
          <time dateTime={date} className={styles.blogPostDate}>
            {year}年{month}月{day}日
          </time>
        </div>
        <div className="avatar margin-vert--md">
          {authorImageURL && (
            <a
              className="avatar__photo-link avatar__photo"
              href={authorURL}
              target="_blank"
              rel="noreferrer noopener"
            >
              <img src={authorImageURL} alt={author} />
            </a>
          )}
          <div className="avatar__intro">
            {author && (
              <>
                <h4 className="avatar__name">
                  <a href={authorURL} target="_blank" rel="noreferrer noopener">
                    {author}
                  </a>
                </h4>
                <small className="avatar__subtitle">{authorTitle}</small>
              </>
            )}
          </div>
        </div>
      </header>
    );
  };

  return (
    <article className={!isBlogPostPage ? 'margin-bottom--xl' : undefined}>
      {renderPostHeader()}
      <section className="markdown">
        <MDXProvider components={MDXComponents}>{children}</MDXProvider>
      </section>
      {(tags.length > 0 || truncated) && (
        <footer className="row margin-vert--lg">
          {tags.length > 0 && (
            <div className="col">
              <strong>标签:</strong>
              {tags.map(({ label, permalink: tagPermalink }) => (
                <Link
                  key={tagPermalink}
                  className="margin-horiz--sm"
                  to={tagPermalink}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
          {truncated && (
            <div className="col text--right">
              <Link
                to={metadata.permalink}
                aria-label={`查看 ${title} 更多信息`}
              >
                <strong>查看详情</strong>
              </Link>
            </div>
          )}
        </footer>
      )}
    </article>
  );
}

export default BlogPostItem;

import { graphql, VideoMetadataFragment } from "@lens-protocol/react";

export const PostMetadataFragment = graphql(
  `
    fragment PostMetadata on PostMetadata {
      __typename
      ... on VideoMetadata {
        ...VideoMetadata
        attributes {
          type
          key
          value
        }
      }
    }
  `,
  [VideoMetadataFragment]
);

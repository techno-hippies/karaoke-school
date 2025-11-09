import type { FragmentOf } from "@lens-protocol/react";
import { AccountFragment, AccountMetadataFragment } from "./accounts";
import { PostMetadataFragment } from "./posts";

declare module "@lens-protocol/react" {
  export type Account = FragmentOf<typeof AccountFragment>
  export type AccountMetadata = FragmentOf<typeof AccountMetadataFragment>
  export type PostMetadata = FragmentOf<typeof PostMetadataFragment>;
}

export const fragments = [
  AccountFragment,
  PostMetadataFragment,
];

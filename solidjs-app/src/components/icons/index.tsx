/**
 * Icon component using phosphor-icons-solid
 * https://github.com/babakfp/phosphor-icons-solid
 *
 * Usage:
 *   <Icon name="house" />
 *   <Icon name="house" weight="fill" />
 *   <Icon name="crown" class="text-yellow-500 text-2xl" />
 *
 * Uses individual imports for guaranteed tree-shaking (~1-2KB per icon vs 8MB for all)
 */

import type { Component, JSX } from 'solid-js'
import { splitProps } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { cn } from '@/lib/utils'

// Import all needed icons - each is ~1-2KB
// Regular weight
import IconHouseRegular from 'phosphor-icons-solid/IconHouseRegular'
import IconMagnifyingGlassRegular from 'phosphor-icons-solid/IconMagnifyingGlassRegular'
import IconExamRegular from 'phosphor-icons-solid/IconExamRegular'
import IconChatCircleRegular from 'phosphor-icons-solid/IconChatCircleRegular'
import IconWalletRegular from 'phosphor-icons-solid/IconWalletRegular'
import IconKeyRegular from 'phosphor-icons-solid/IconKeyRegular'
import IconCheckCircleRegular from 'phosphor-icons-solid/IconCheckCircleRegular'
import IconWarningCircleRegular from 'phosphor-icons-solid/IconWarningCircleRegular'
import IconCaretLeftRegular from 'phosphor-icons-solid/IconCaretLeftRegular'
import IconXRegular from 'phosphor-icons-solid/IconXRegular'
import IconPlayRegular from 'phosphor-icons-solid/IconPlayRegular'
import IconPauseRegular from 'phosphor-icons-solid/IconPauseRegular'
import IconMusicNoteRegular from 'phosphor-icons-solid/IconMusicNoteRegular'
import IconMusicNotesSimpleRegular from 'phosphor-icons-solid/IconMusicNotesSimpleRegular'
import IconUserRegular from 'phosphor-icons-solid/IconUserRegular'
import IconPaperPlaneRightRegular from 'phosphor-icons-solid/IconPaperPlaneRightRegular'
import IconWaveformRegular from 'phosphor-icons-solid/IconWaveformRegular'
import IconStopRegular from 'phosphor-icons-solid/IconStopRegular'
import IconTranslateRegular from 'phosphor-icons-solid/IconTranslateRegular'
import IconSpeakerHighRegular from 'phosphor-icons-solid/IconSpeakerHighRegular'
import IconSpeakerSlashRegular from 'phosphor-icons-solid/IconSpeakerSlashRegular'
import IconSparkleRegular from 'phosphor-icons-solid/IconSparkleRegular'
import IconWarningRegular from 'phosphor-icons-solid/IconWarningRegular'
import IconCopyRegular from 'phosphor-icons-solid/IconCopyRegular'
import IconCheckRegular from 'phosphor-icons-solid/IconCheckRegular'
import IconSignOutRegular from 'phosphor-icons-solid/IconSignOutRegular'
import IconHeartRegular from 'phosphor-icons-solid/IconHeartRegular'
import IconShareNetworkRegular from 'phosphor-icons-solid/IconShareNetworkRegular'
import IconBooksRegular from 'phosphor-icons-solid/IconBooksRegular'
import IconPlusRegular from 'phosphor-icons-solid/IconPlusRegular'
import IconLockSimpleRegular from 'phosphor-icons-solid/IconLockSimpleRegular'
import IconGlobeRegular from 'phosphor-icons-solid/IconGlobeRegular'
import IconCrownRegular from 'phosphor-icons-solid/IconCrownRegular'
import IconCrownCrossRegular from 'phosphor-icons-solid/IconCrownCrossRegular'
import IconMicrophoneRegular from 'phosphor-icons-solid/IconMicrophoneRegular'
import IconArrowLeftRegular from 'phosphor-icons-solid/IconArrowLeftRegular'
import IconArrowRightRegular from 'phosphor-icons-solid/IconArrowRightRegular'
import IconCaretRightRegular from 'phosphor-icons-solid/IconCaretRightRegular'
import IconCaretDownRegular from 'phosphor-icons-solid/IconCaretDownRegular'
import IconCaretUpRegular from 'phosphor-icons-solid/IconCaretUpRegular'
import IconDotsThreeRegular from 'phosphor-icons-solid/IconDotsThreeRegular'
import IconGearRegular from 'phosphor-icons-solid/IconGearRegular'
import IconInfoRegular from 'phosphor-icons-solid/IconInfoRegular'
import IconQuestionRegular from 'phosphor-icons-solid/IconQuestionRegular'
import IconTrashRegular from 'phosphor-icons-solid/IconTrashRegular'
import IconPencilRegular from 'phosphor-icons-solid/IconPencilRegular'
import IconEyeRegular from 'phosphor-icons-solid/IconEyeRegular'
import IconEyeSlashRegular from 'phosphor-icons-solid/IconEyeSlashRegular'
import IconLinkRegular from 'phosphor-icons-solid/IconLinkRegular'
import IconChatTextRegular from 'phosphor-icons-solid/IconChatTextRegular'
import IconImageRegular from 'phosphor-icons-solid/IconImageRegular'
import IconVideoCameraRegular from 'phosphor-icons-solid/IconVideoCameraRegular'
import IconMusicNotesRegular from 'phosphor-icons-solid/IconMusicNotesRegular'
import IconListRegular from 'phosphor-icons-solid/IconListRegular'
import IconSquaresFourRegular from 'phosphor-icons-solid/IconSquaresFourRegular'
import IconSpinnerRegular from 'phosphor-icons-solid/IconSpinnerRegular'
import IconCircleNotchRegular from 'phosphor-icons-solid/IconCircleNotchRegular'
import IconRepeatRegular from 'phosphor-icons-solid/IconRepeatRegular'
import IconShuffleRegular from 'phosphor-icons-solid/IconShuffleRegular'
import IconSkipBackRegular from 'phosphor-icons-solid/IconSkipBackRegular'
import IconSkipForwardRegular from 'phosphor-icons-solid/IconSkipForwardRegular'
import IconRewindRegular from 'phosphor-icons-solid/IconRewindRegular'
import IconFastForwardRegular from 'phosphor-icons-solid/IconFastForwardRegular'
import IconSealCheckRegular from 'phosphor-icons-solid/IconSealCheckRegular'
import IconGoogleLogoRegular from 'phosphor-icons-solid/IconGoogleLogoRegular'
import IconDiscordLogoRegular from 'phosphor-icons-solid/IconDiscordLogoRegular'
import IconArrowClockwiseRegular from 'phosphor-icons-solid/IconArrowClockwiseRegular'
import IconXCircleRegular from 'phosphor-icons-solid/IconXCircleRegular'

// Fill weight
import IconHouseFill from 'phosphor-icons-solid/IconHouseFill'
import IconMagnifyingGlassFill from 'phosphor-icons-solid/IconMagnifyingGlassFill'
import IconExamFill from 'phosphor-icons-solid/IconExamFill'
import IconChatCircleFill from 'phosphor-icons-solid/IconChatCircleFill'
import IconWalletFill from 'phosphor-icons-solid/IconWalletFill'
import IconKeyFill from 'phosphor-icons-solid/IconKeyFill'
import IconCheckCircleFill from 'phosphor-icons-solid/IconCheckCircleFill'
import IconWarningCircleFill from 'phosphor-icons-solid/IconWarningCircleFill'
import IconCaretLeftFill from 'phosphor-icons-solid/IconCaretLeftFill'
import IconXFill from 'phosphor-icons-solid/IconXFill'
import IconPlayFill from 'phosphor-icons-solid/IconPlayFill'
import IconPauseFill from 'phosphor-icons-solid/IconPauseFill'
import IconMusicNoteFill from 'phosphor-icons-solid/IconMusicNoteFill'
import IconMusicNotesSimpleFill from 'phosphor-icons-solid/IconMusicNotesSimpleFill'
import IconUserFill from 'phosphor-icons-solid/IconUserFill'
import IconPaperPlaneRightFill from 'phosphor-icons-solid/IconPaperPlaneRightFill'
import IconWaveformFill from 'phosphor-icons-solid/IconWaveformFill'
import IconStopFill from 'phosphor-icons-solid/IconStopFill'
import IconTranslateFill from 'phosphor-icons-solid/IconTranslateFill'
import IconSpeakerHighFill from 'phosphor-icons-solid/IconSpeakerHighFill'
import IconSpeakerSlashFill from 'phosphor-icons-solid/IconSpeakerSlashFill'
import IconSparkleFill from 'phosphor-icons-solid/IconSparkleFill'
import IconWarningFill from 'phosphor-icons-solid/IconWarningFill'
import IconCopyFill from 'phosphor-icons-solid/IconCopyFill'
import IconCheckFill from 'phosphor-icons-solid/IconCheckFill'
import IconSignOutFill from 'phosphor-icons-solid/IconSignOutFill'
import IconHeartFill from 'phosphor-icons-solid/IconHeartFill'
import IconShareNetworkFill from 'phosphor-icons-solid/IconShareNetworkFill'
import IconBooksFill from 'phosphor-icons-solid/IconBooksFill'
import IconPlusFill from 'phosphor-icons-solid/IconPlusFill'
import IconLockSimpleFill from 'phosphor-icons-solid/IconLockSimpleFill'
import IconGlobeFill from 'phosphor-icons-solid/IconGlobeFill'
import IconCrownFill from 'phosphor-icons-solid/IconCrownFill'
import IconCrownCrossFill from 'phosphor-icons-solid/IconCrownCrossFill'
import IconMicrophoneFill from 'phosphor-icons-solid/IconMicrophoneFill'
import IconArrowLeftFill from 'phosphor-icons-solid/IconArrowLeftFill'
import IconArrowRightFill from 'phosphor-icons-solid/IconArrowRightFill'
import IconCaretRightFill from 'phosphor-icons-solid/IconCaretRightFill'
import IconCaretDownFill from 'phosphor-icons-solid/IconCaretDownFill'
import IconCaretUpFill from 'phosphor-icons-solid/IconCaretUpFill'
import IconDotsThreeFill from 'phosphor-icons-solid/IconDotsThreeFill'
import IconGearFill from 'phosphor-icons-solid/IconGearFill'
import IconInfoFill from 'phosphor-icons-solid/IconInfoFill'
import IconQuestionFill from 'phosphor-icons-solid/IconQuestionFill'
import IconTrashFill from 'phosphor-icons-solid/IconTrashFill'
import IconPencilFill from 'phosphor-icons-solid/IconPencilFill'
import IconEyeFill from 'phosphor-icons-solid/IconEyeFill'
import IconEyeSlashFill from 'phosphor-icons-solid/IconEyeSlashFill'
import IconLinkFill from 'phosphor-icons-solid/IconLinkFill'
import IconChatTextFill from 'phosphor-icons-solid/IconChatTextFill'
import IconImageFill from 'phosphor-icons-solid/IconImageFill'
import IconVideoCameraFill from 'phosphor-icons-solid/IconVideoCameraFill'
import IconMusicNotesFill from 'phosphor-icons-solid/IconMusicNotesFill'
import IconListFill from 'phosphor-icons-solid/IconListFill'
import IconSquaresFourFill from 'phosphor-icons-solid/IconSquaresFourFill'
import IconSpinnerFill from 'phosphor-icons-solid/IconSpinnerFill'
import IconCircleNotchFill from 'phosphor-icons-solid/IconCircleNotchFill'
import IconRepeatFill from 'phosphor-icons-solid/IconRepeatFill'
import IconShuffleFill from 'phosphor-icons-solid/IconShuffleFill'
import IconSkipBackFill from 'phosphor-icons-solid/IconSkipBackFill'
import IconSkipForwardFill from 'phosphor-icons-solid/IconSkipForwardFill'
import IconRewindFill from 'phosphor-icons-solid/IconRewindFill'
import IconFastForwardFill from 'phosphor-icons-solid/IconFastForwardFill'
import IconSealCheckFill from 'phosphor-icons-solid/IconSealCheckFill'
import IconGoogleLogoFill from 'phosphor-icons-solid/IconGoogleLogoFill'
import IconDiscordLogoFill from 'phosphor-icons-solid/IconDiscordLogoFill'
import IconArrowClockwiseFill from 'phosphor-icons-solid/IconArrowClockwiseFill'
import IconXCircleFill from 'phosphor-icons-solid/IconXCircleFill'

// Bold weight
import IconHouseBold from 'phosphor-icons-solid/IconHouseBold'
import IconMagnifyingGlassBold from 'phosphor-icons-solid/IconMagnifyingGlassBold'
import IconExamBold from 'phosphor-icons-solid/IconExamBold'
import IconChatCircleBold from 'phosphor-icons-solid/IconChatCircleBold'
import IconWalletBold from 'phosphor-icons-solid/IconWalletBold'
import IconKeyBold from 'phosphor-icons-solid/IconKeyBold'
import IconCheckCircleBold from 'phosphor-icons-solid/IconCheckCircleBold'
import IconWarningCircleBold from 'phosphor-icons-solid/IconWarningCircleBold'
import IconCaretLeftBold from 'phosphor-icons-solid/IconCaretLeftBold'
import IconXBold from 'phosphor-icons-solid/IconXBold'
import IconPlayBold from 'phosphor-icons-solid/IconPlayBold'
import IconPauseBold from 'phosphor-icons-solid/IconPauseBold'
import IconMusicNoteBold from 'phosphor-icons-solid/IconMusicNoteBold'
import IconMusicNotesSimpleBold from 'phosphor-icons-solid/IconMusicNotesSimpleBold'
import IconUserBold from 'phosphor-icons-solid/IconUserBold'
import IconPaperPlaneRightBold from 'phosphor-icons-solid/IconPaperPlaneRightBold'
import IconWaveformBold from 'phosphor-icons-solid/IconWaveformBold'
import IconStopBold from 'phosphor-icons-solid/IconStopBold'
import IconTranslateBold from 'phosphor-icons-solid/IconTranslateBold'
import IconSpeakerHighBold from 'phosphor-icons-solid/IconSpeakerHighBold'
import IconSpeakerSlashBold from 'phosphor-icons-solid/IconSpeakerSlashBold'
import IconSparkleBold from 'phosphor-icons-solid/IconSparkleBold'
import IconWarningBold from 'phosphor-icons-solid/IconWarningBold'
import IconCopyBold from 'phosphor-icons-solid/IconCopyBold'
import IconCheckBold from 'phosphor-icons-solid/IconCheckBold'
import IconSignOutBold from 'phosphor-icons-solid/IconSignOutBold'
import IconHeartBold from 'phosphor-icons-solid/IconHeartBold'
import IconShareNetworkBold from 'phosphor-icons-solid/IconShareNetworkBold'
import IconBooksBold from 'phosphor-icons-solid/IconBooksBold'
import IconPlusBold from 'phosphor-icons-solid/IconPlusBold'
import IconLockSimpleBold from 'phosphor-icons-solid/IconLockSimpleBold'
import IconGlobeBold from 'phosphor-icons-solid/IconGlobeBold'
import IconCrownBold from 'phosphor-icons-solid/IconCrownBold'
import IconCrownCrossBold from 'phosphor-icons-solid/IconCrownCrossBold'
import IconMicrophoneBold from 'phosphor-icons-solid/IconMicrophoneBold'
import IconArrowLeftBold from 'phosphor-icons-solid/IconArrowLeftBold'
import IconArrowRightBold from 'phosphor-icons-solid/IconArrowRightBold'
import IconCaretRightBold from 'phosphor-icons-solid/IconCaretRightBold'
import IconCaretDownBold from 'phosphor-icons-solid/IconCaretDownBold'
import IconCaretUpBold from 'phosphor-icons-solid/IconCaretUpBold'
import IconDotsThreeBold from 'phosphor-icons-solid/IconDotsThreeBold'
import IconGearBold from 'phosphor-icons-solid/IconGearBold'
import IconInfoBold from 'phosphor-icons-solid/IconInfoBold'
import IconQuestionBold from 'phosphor-icons-solid/IconQuestionBold'
import IconTrashBold from 'phosphor-icons-solid/IconTrashBold'
import IconPencilBold from 'phosphor-icons-solid/IconPencilBold'
import IconEyeBold from 'phosphor-icons-solid/IconEyeBold'
import IconEyeSlashBold from 'phosphor-icons-solid/IconEyeSlashBold'
import IconLinkBold from 'phosphor-icons-solid/IconLinkBold'
import IconChatTextBold from 'phosphor-icons-solid/IconChatTextBold'
import IconImageBold from 'phosphor-icons-solid/IconImageBold'
import IconVideoCameraBold from 'phosphor-icons-solid/IconVideoCameraBold'
import IconMusicNotesBold from 'phosphor-icons-solid/IconMusicNotesBold'
import IconListBold from 'phosphor-icons-solid/IconListBold'
import IconSquaresFourBold from 'phosphor-icons-solid/IconSquaresFourBold'
import IconSpinnerBold from 'phosphor-icons-solid/IconSpinnerBold'
import IconCircleNotchBold from 'phosphor-icons-solid/IconCircleNotchBold'
import IconRepeatBold from 'phosphor-icons-solid/IconRepeatBold'
import IconShuffleBold from 'phosphor-icons-solid/IconShuffleBold'
import IconSkipBackBold from 'phosphor-icons-solid/IconSkipBackBold'
import IconSkipForwardBold from 'phosphor-icons-solid/IconSkipForwardBold'
import IconRewindBold from 'phosphor-icons-solid/IconRewindBold'
import IconFastForwardBold from 'phosphor-icons-solid/IconFastForwardBold'
import IconSealCheckBold from 'phosphor-icons-solid/IconSealCheckBold'
import IconGoogleLogoBold from 'phosphor-icons-solid/IconGoogleLogoBold'
import IconDiscordLogoBold from 'phosphor-icons-solid/IconDiscordLogoBold'
import IconArrowClockwiseBold from 'phosphor-icons-solid/IconArrowClockwiseBold'
import IconXCircleBold from 'phosphor-icons-solid/IconXCircleBold'

export type IconWeight = 'regular' | 'fill' | 'bold'

export type IconName =
  | 'house'
  | 'magnifying-glass'
  | 'exam'
  | 'chat-circle'
  | 'wallet'
  | 'key'
  | 'check-circle'
  | 'warning-circle'
  | 'caret-left'
  | 'x'
  | 'play'
  | 'pause'
  | 'music-note'
  | 'music-notes-simple'
  | 'user'
  | 'paper-plane-right'
  | 'waveform'
  | 'stop'
  | 'translate'
  | 'speaker-high'
  | 'speaker-slash'
  | 'sparkle'
  | 'warning'
  | 'copy'
  | 'check'
  | 'sign-out'
  | 'heart'
  | 'share-network'
  | 'books'
  | 'plus'
  | 'lock-simple'
  | 'globe'
  | 'crown'
  | 'crown-cross'
  | 'microphone'
  | 'arrow-left'
  | 'arrow-right'
  | 'caret-right'
  | 'caret-down'
  | 'caret-up'
  | 'dots-three'
  | 'gear'
  | 'info'
  | 'question'
  | 'trash'
  | 'pencil'
  | 'eye'
  | 'eye-slash'
  | 'link'
  | 'chat-text'
  | 'image'
  | 'video-camera'
  | 'music-notes'
  | 'list'
  | 'squares-four'
  | 'spinner'
  | 'circle-notch'
  | 'repeat'
  | 'shuffle'
  | 'skip-back'
  | 'skip-forward'
  | 'rewind'
  | 'fast-forward'
  | 'seal-check'
  | 'google-logo'
  | 'discord-logo'
  | 'arrow-clockwise'
  | 'x-circle'

// Icon lookup map - maps name + weight to component
const iconMap: Record<IconName, Record<IconWeight, Component<{ class?: string }>>> = {
  'house': { regular: IconHouseRegular, fill: IconHouseFill, bold: IconHouseBold },
  'magnifying-glass': { regular: IconMagnifyingGlassRegular, fill: IconMagnifyingGlassFill, bold: IconMagnifyingGlassBold },
  'exam': { regular: IconExamRegular, fill: IconExamFill, bold: IconExamBold },
  'chat-circle': { regular: IconChatCircleRegular, fill: IconChatCircleFill, bold: IconChatCircleBold },
  'wallet': { regular: IconWalletRegular, fill: IconWalletFill, bold: IconWalletBold },
  'key': { regular: IconKeyRegular, fill: IconKeyFill, bold: IconKeyBold },
  'check-circle': { regular: IconCheckCircleRegular, fill: IconCheckCircleFill, bold: IconCheckCircleBold },
  'warning-circle': { regular: IconWarningCircleRegular, fill: IconWarningCircleFill, bold: IconWarningCircleBold },
  'caret-left': { regular: IconCaretLeftRegular, fill: IconCaretLeftFill, bold: IconCaretLeftBold },
  'x': { regular: IconXRegular, fill: IconXFill, bold: IconXBold },
  'play': { regular: IconPlayRegular, fill: IconPlayFill, bold: IconPlayBold },
  'pause': { regular: IconPauseRegular, fill: IconPauseFill, bold: IconPauseBold },
  'music-note': { regular: IconMusicNoteRegular, fill: IconMusicNoteFill, bold: IconMusicNoteBold },
  'music-notes-simple': { regular: IconMusicNotesSimpleRegular, fill: IconMusicNotesSimpleFill, bold: IconMusicNotesSimpleBold },
  'user': { regular: IconUserRegular, fill: IconUserFill, bold: IconUserBold },
  'paper-plane-right': { regular: IconPaperPlaneRightRegular, fill: IconPaperPlaneRightFill, bold: IconPaperPlaneRightBold },
  'waveform': { regular: IconWaveformRegular, fill: IconWaveformFill, bold: IconWaveformBold },
  'stop': { regular: IconStopRegular, fill: IconStopFill, bold: IconStopBold },
  'translate': { regular: IconTranslateRegular, fill: IconTranslateFill, bold: IconTranslateBold },
  'speaker-high': { regular: IconSpeakerHighRegular, fill: IconSpeakerHighFill, bold: IconSpeakerHighBold },
  'speaker-slash': { regular: IconSpeakerSlashRegular, fill: IconSpeakerSlashFill, bold: IconSpeakerSlashBold },
  'sparkle': { regular: IconSparkleRegular, fill: IconSparkleFill, bold: IconSparkleBold },
  'warning': { regular: IconWarningRegular, fill: IconWarningFill, bold: IconWarningBold },
  'copy': { regular: IconCopyRegular, fill: IconCopyFill, bold: IconCopyBold },
  'check': { regular: IconCheckRegular, fill: IconCheckFill, bold: IconCheckBold },
  'sign-out': { regular: IconSignOutRegular, fill: IconSignOutFill, bold: IconSignOutBold },
  'heart': { regular: IconHeartRegular, fill: IconHeartFill, bold: IconHeartBold },
  'share-network': { regular: IconShareNetworkRegular, fill: IconShareNetworkFill, bold: IconShareNetworkBold },
  'books': { regular: IconBooksRegular, fill: IconBooksFill, bold: IconBooksBold },
  'plus': { regular: IconPlusRegular, fill: IconPlusFill, bold: IconPlusBold },
  'lock-simple': { regular: IconLockSimpleRegular, fill: IconLockSimpleFill, bold: IconLockSimpleBold },
  'globe': { regular: IconGlobeRegular, fill: IconGlobeFill, bold: IconGlobeBold },
  'crown': { regular: IconCrownRegular, fill: IconCrownFill, bold: IconCrownBold },
  'crown-cross': { regular: IconCrownCrossRegular, fill: IconCrownCrossFill, bold: IconCrownCrossBold },
  'microphone': { regular: IconMicrophoneRegular, fill: IconMicrophoneFill, bold: IconMicrophoneBold },
  'arrow-left': { regular: IconArrowLeftRegular, fill: IconArrowLeftFill, bold: IconArrowLeftBold },
  'arrow-right': { regular: IconArrowRightRegular, fill: IconArrowRightFill, bold: IconArrowRightBold },
  'caret-right': { regular: IconCaretRightRegular, fill: IconCaretRightFill, bold: IconCaretRightBold },
  'caret-down': { regular: IconCaretDownRegular, fill: IconCaretDownFill, bold: IconCaretDownBold },
  'caret-up': { regular: IconCaretUpRegular, fill: IconCaretUpFill, bold: IconCaretUpBold },
  'dots-three': { regular: IconDotsThreeRegular, fill: IconDotsThreeFill, bold: IconDotsThreeBold },
  'gear': { regular: IconGearRegular, fill: IconGearFill, bold: IconGearBold },
  'info': { regular: IconInfoRegular, fill: IconInfoFill, bold: IconInfoBold },
  'question': { regular: IconQuestionRegular, fill: IconQuestionFill, bold: IconQuestionBold },
  'trash': { regular: IconTrashRegular, fill: IconTrashFill, bold: IconTrashBold },
  'pencil': { regular: IconPencilRegular, fill: IconPencilFill, bold: IconPencilBold },
  'eye': { regular: IconEyeRegular, fill: IconEyeFill, bold: IconEyeBold },
  'eye-slash': { regular: IconEyeSlashRegular, fill: IconEyeSlashFill, bold: IconEyeSlashBold },
  'link': { regular: IconLinkRegular, fill: IconLinkFill, bold: IconLinkBold },
  'chat-text': { regular: IconChatTextRegular, fill: IconChatTextFill, bold: IconChatTextBold },
  'image': { regular: IconImageRegular, fill: IconImageFill, bold: IconImageBold },
  'video-camera': { regular: IconVideoCameraRegular, fill: IconVideoCameraFill, bold: IconVideoCameraBold },
  'music-notes': { regular: IconMusicNotesRegular, fill: IconMusicNotesFill, bold: IconMusicNotesBold },
  'list': { regular: IconListRegular, fill: IconListFill, bold: IconListBold },
  'squares-four': { regular: IconSquaresFourRegular, fill: IconSquaresFourFill, bold: IconSquaresFourBold },
  'spinner': { regular: IconSpinnerRegular, fill: IconSpinnerFill, bold: IconSpinnerBold },
  'circle-notch': { regular: IconCircleNotchRegular, fill: IconCircleNotchFill, bold: IconCircleNotchBold },
  'repeat': { regular: IconRepeatRegular, fill: IconRepeatFill, bold: IconRepeatBold },
  'shuffle': { regular: IconShuffleRegular, fill: IconShuffleFill, bold: IconShuffleBold },
  'skip-back': { regular: IconSkipBackRegular, fill: IconSkipBackFill, bold: IconSkipBackBold },
  'skip-forward': { regular: IconSkipForwardRegular, fill: IconSkipForwardFill, bold: IconSkipForwardBold },
  'rewind': { regular: IconRewindRegular, fill: IconRewindFill, bold: IconRewindBold },
  'fast-forward': { regular: IconFastForwardRegular, fill: IconFastForwardFill, bold: IconFastForwardBold },
  'seal-check': { regular: IconSealCheckRegular, fill: IconSealCheckFill, bold: IconSealCheckBold },
  'google-logo': { regular: IconGoogleLogoRegular, fill: IconGoogleLogoFill, bold: IconGoogleLogoBold },
  'discord-logo': { regular: IconDiscordLogoRegular, fill: IconDiscordLogoFill, bold: IconDiscordLogoBold },
  'arrow-clockwise': { regular: IconArrowClockwiseRegular, fill: IconArrowClockwiseFill, bold: IconArrowClockwiseBold },
  'x-circle': { regular: IconXCircleRegular, fill: IconXCircleFill, bold: IconXCircleBold },
}

export interface IconProps extends JSX.HTMLAttributes<SVGSVGElement> {
  name: IconName
  weight?: IconWeight
}

/**
 * Icon component using Phosphor Icons (tree-shakeable SVG components)
 *
 * @example
 * <Icon name="house" />
 * <Icon name="heart" weight="fill" class="text-red-500 text-2xl" />
 */
export const Icon: Component<IconProps> = (props) => {
  const [local, others] = splitProps(props, ['name', 'weight', 'class'])

  const IconComponent = () => iconMap[local.name]?.[local.weight ?? 'regular']

  return (
    <Dynamic
      component={IconComponent()}
      class={cn(local.class)}
      {...others}
    />
  )
}

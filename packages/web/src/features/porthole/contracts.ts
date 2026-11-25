import type { PathParams, PathResponse } from '@/api/auto'

export type PortSnapshot = PathResponse<'/porthole/ports', 'get'>['data']
export type DiscoveredPort = PortSnapshot['ports'][number]
export type Share = PathResponse<'/porthole/shares', 'get'>['data'][number]
export type ShareCreate = PathParams<'/porthole/shares', 'post'>['body']
export type ShareChange = PathParams<'/porthole/shares/{id}', 'patch'>['body']
export type ShareResult = PathResponse<'/porthole/shares', 'post'>['data']
export type ShareEdit = Extract<ShareChange, { action: 'edit' }>
export type UpstreamAction = Exclude<ShareChange['action'], 'edit'>
export type ShareConfirmationAction = 'delete' | 'reconnect' | 'revoke'
export type ShareRecordAction = 'copy' | 'details' | 'edit' | 'extend' | 'qr' | ShareConfirmationAction
export type ShareStatus = Share['status']

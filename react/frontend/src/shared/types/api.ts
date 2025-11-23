type ISODateTime = string;
type ISODate = string;

export interface UserDto {
  id: number;
  email: string;
  nickname: string;
  createdAt: ISODateTime;
}

export interface ProjectDto {
  id: number;
  name: string;
  description: string | null;
  createdAt: ISODateTime;
}

export type IssueStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface IssueDto {
  id: number;
  projectId: number;
  reporterId: number;
  assigneeId: number | null;
  title: string;
  description: string;
  status: IssueStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CommentDto {
  id: number;
  issueId: number;
  authorId: number;
  content: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface TeamDto {
  id: number;
  name: string;
  createdAt: ISODateTime;
}

export type TeamRole = 'OWNER' | 'MANAGER' | 'MEMBER';

export interface TeamMemberDto {
  id: number;
  teamId: number;
  userId: number;
  role: TeamRole;
  joinedAt: ISODateTime;
  user: Pick<UserDto, 'id' | 'email' | 'nickname'>;
}

export interface WorkspaceItemDto {
  id: number;
  teamId: number;
  title: string;
  content: string;
  createdBy: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface DailyIssueStatsDto {
  date: ISODate;
  createdCount: number;
  resolvedCount: number;
  commentCount: number;
  createdAt: ISODateTime;
}

export interface PopularIssueDto {
  issue: IssueDto;
  viewCount: number;
  commentCount: number;
  score: number;
}

export type ProductStatus = 'ACTIVE' | 'INACTIVE';

export interface ProductDto {
  id: number;
  name: string;
  description: string;
  category: string;
  brand: string;
  price: number;
  status: ProductStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// API Response Types
export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface LoginResponse {
  accessToken: string;
  user: UserDto;
}

// Request Types
export interface CreateUserRequest {
  email: string;
  password: string;
  nickname: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface CreateIssueRequest {
  title: string;
  description: string;
  assigneeId?: number;
}

export interface UpdateIssueRequest {
  title: string;
  description: string;
  status: IssueStatus;
  assigneeId?: number | null;
}

export interface CreateCommentRequest {
  content: string;
}

export interface CreateTeamRequest {
  name: string;
}

export interface AddTeamMemberRequest {
  userId: number;
  role: TeamRole;
}

export interface UpdateTeamMemberRequest {
  role: TeamRole;
}

export interface CreateWorkspaceItemRequest {
  title: string;
  content: string;
}

export interface UpdateWorkspaceItemRequest {
  title: string;
  content: string;
}

export interface ProductSearchParams {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  size?: number;
}

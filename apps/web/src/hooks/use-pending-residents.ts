import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiResponseEnvelope,
  CreateLeaderDto,
  LockResidentDto,
  ManagedResidentQueryDto,
  RejectResidentDto,
  UserDto,
} from '@quanlykhupho/shared-types';
import { apiClient } from '../lib/api-client';

export function usePendingResidents(neighborhoodId?: string) {
  return useQuery({
    queryKey: ['pending-residents', neighborhoodId],
    queryFn: async (): Promise<UserDto[]> => {
      const params = neighborhoodId ? { neighborhoodId } : {};
      const res = await apiClient.get<ApiResponseEnvelope<UserDto[]>>(
        '/users/pending',
        { params },
      );
      return res.data.data;
    },
  });
}

export function useManagedResidents(query?: ManagedResidentQueryDto) {
  return useQuery({
    queryKey: ['managed-residents', query],
    queryFn: async (): Promise<UserDto[]> => {
      const params: Record<string, string> = {};
      if (query?.status) {
        params.status = query.status;
      }
      if (query?.neighborhoodId) {
        params.neighborhoodId = query.neighborhoodId;
      }
      const res = await apiClient.get<ApiResponseEnvelope<UserDto[]>>(
        '/users/residents',
        { params },
      );
      return res.data.data;
    },
  });
}

export function useApproveResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (residentId: string): Promise<UserDto> => {
      const res = await apiClient.patch<ApiResponseEnvelope<UserDto>>(
        `/users/${residentId}/approve`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-residents'] });
      queryClient.invalidateQueries({ queryKey: ['managed-residents'] });
    },
  });
}

export function useRejectResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      residentId,
      dto,
    }: {
      residentId: string;
      dto: RejectResidentDto;
    }): Promise<UserDto> => {
      const res = await apiClient.patch<ApiResponseEnvelope<UserDto>>(
        `/users/${residentId}/reject`,
        dto,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-residents'] });
      queryClient.invalidateQueries({ queryKey: ['managed-residents'] });
    },
  });
}

export function useLockResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      residentId,
      dto,
    }: {
      residentId: string;
      dto: LockResidentDto;
    }): Promise<UserDto> => {
      const res = await apiClient.patch<ApiResponseEnvelope<UserDto>>(
        `/users/${residentId}/lock`,
        dto,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-residents'] });
      queryClient.invalidateQueries({ queryKey: ['managed-residents'] });
    },
  });
}

export function useUnlockResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (residentId: string): Promise<UserDto> => {
      const res = await apiClient.patch<ApiResponseEnvelope<UserDto>>(
        `/users/${residentId}/unlock`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-residents'] });
      queryClient.invalidateQueries({ queryKey: ['managed-residents'] });
    },
  });
}

export function useCreateLeader() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateLeaderDto): Promise<UserDto> => {
      const res = await apiClient.post<ApiResponseEnvelope<UserDto>>(
        '/users/leaders',
        dto,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-residents'] });
      queryClient.invalidateQueries({ queryKey: ['managed-residents'] });
    },
  });
}

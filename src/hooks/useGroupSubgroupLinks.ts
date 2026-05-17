import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUser } from '@/lib/auth/currentUser';

export interface GroupSubgroupLink {
  id: string;
  group_id: string;
  subgroup_id: string;
  tenant_id: string;
}

export function useGroupSubgroupLinks() {
  const queryClient = useQueryClient();

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['product_group_subgroups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_group_subgroups')
        .select('id, group_id, subgroup_id, tenant_id');
      if (error) throw error;
      return (data || []) as GroupSubgroupLink[];
    },
  });

  const linksByGroup = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const l of links) {
      (map[l.group_id] ||= []).push(l.subgroup_id);
    }
    return map;
  }, [links]);

  const linksBySubgroup = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const l of links) {
      (map[l.subgroup_id] ||= []).push(l.group_id);
    }
    return map;
  }, [links]);

  async function resolveTenantId(): Promise<string> {
    const { data: userData } = await ({ data: { user: await getCurrentUser() } } as { data: { user: Awaited<ReturnType<typeof getCurrentUser>> } });
    const uid = userData.user?.id;
    if (!uid) throw new Error('Não autenticado');
    const { data, error } = await supabase
      .from('profiles')
      .select('active_tenant_id')
      .eq('user_id', uid)
      .single();
    if (error) throw error;
    if (!data?.active_tenant_id) throw new Error('Tenant ativo não encontrado');
    return data.active_tenant_id;
  }

  const setGroupLinks = useMutation({
    mutationFn: async ({ groupId, subgroupIds }: { groupId: string; subgroupIds: string[] }) => {
      const tenantId = await resolveTenantId();
      const current = linksByGroup[groupId] || [];
      const toAdd = subgroupIds.filter(id => !current.includes(id));
      const toRemove = current.filter(id => !subgroupIds.includes(id));

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('product_group_subgroups')
          .delete()
          .eq('group_id', groupId)
          .in('subgroup_id', toRemove);
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('product_group_subgroups')
          .insert(toAdd.map(sid => ({ group_id: groupId, subgroup_id: sid, tenant_id: tenantId })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product_group_subgroups'] });
    },
  });

  const setSubgroupLinks = useMutation({
    mutationFn: async ({ subgroupId, groupIds }: { subgroupId: string; groupIds: string[] }) => {
      const tenantId = await resolveTenantId();
      const current = linksBySubgroup[subgroupId] || [];
      const toAdd = groupIds.filter(id => !current.includes(id));
      const toRemove = current.filter(id => !groupIds.includes(id));

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('product_group_subgroups')
          .delete()
          .eq('subgroup_id', subgroupId)
          .in('group_id', toRemove);
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('product_group_subgroups')
          .insert(toAdd.map(gid => ({ group_id: gid, subgroup_id: subgroupId, tenant_id: tenantId })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product_group_subgroups'] });
    },
  });

  return { links, linksByGroup, linksBySubgroup, isLoading, setGroupLinks, setSubgroupLinks };
}

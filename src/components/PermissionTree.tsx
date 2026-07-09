/**
 * 树形权限选择器组件
 *
 * 按模块分组展示权限码，支持勾选和数据权限配置。
 */

"use client";

import React, { useMemo } from "react";
import { Tree, Select, Tag } from "antd";
import type { TreeDataNode } from "antd";

const MODULE_TAG_COLORS = [
  "blue",
  "green",
  "purple",
  "orange",
  "red",
  "cyan",
  "geekblue",
  "magenta",
  "gold",
];

function getModuleColor(module: string) {
  const hash = [...module].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return MODULE_TAG_COLORS[hash % MODULE_TAG_COLORS.length];
}

interface PermissionItem {
  id: number;
  code: string;
  name: string;
  module: string;
  type: string;
  description: string | null;
  status: number;
  sort_order?: number;
}

interface PermissionTreeProps {
  allPermissions: PermissionItem[];
  selectedKeys: string[];
  dataScopes: Record<string, string>;
  onCheckedChange: (keys: string[]) => void;
  onDataScopeChange: (code: string, scope: string) => void;
}

export default function PermissionTree({
  allPermissions,
  selectedKeys,
  dataScopes,
  onCheckedChange,
  onDataScopeChange,
}: PermissionTreeProps) {
  const treeData = useMemo<TreeDataNode[]>(() => {
    const grouped = allPermissions.reduce<Record<string, PermissionItem[]>>((acc, permission) => {
      const module = permission.module || "unknown";
      if (!acc[module]) {
        acc[module] = [];
      }
      acc[module].push(permission);
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([moduleA], [moduleB]) => moduleA.localeCompare(moduleB))
      .map(([module, permissions]) => ({
        key: `module_${module}`,
        title: (
          <span className="font-medium">
            <Tag color={getModuleColor(module)}>{module}</Tag>
          </span>
        ),
        selectable: false,
        checkable: false,
        children: [...permissions]
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id)
          .map((perm) => ({
            key: perm.code,
            title: perm.name,
            isLeaf: true,
          })),
      }));
  }, [allPermissions]);

  const handleCheck = (checked: React.Key[] | { checked: React.Key[]; halfChecked: React.Key[] }) => {
    const keys = typeof checked === 'object' && 'checked' in checked
      ? checked.checked
      : checked;
    onCheckedChange(keys as string[]);
  };

  const titleRender = (nodeData: TreeDataNode) => {
    const isChecked = selectedKeys.includes(nodeData.key as string);

    return (
      <div className="flex items-center justify-between w-full pr-1">
        <span>{nodeData.title as string}</span>
        {isChecked && (
          <Select
            size="small"
            value={dataScopes[nodeData.key as string] || "self"}
            onChange={(value) =>
              onDataScopeChange(nodeData.key as string, value)
            }
            style={{ width: 72 }}
            onClick={(e) => e.stopPropagation()}
            onOpenChange={(visible) => {
              if (visible) {
                setTimeout(() => {
                  const dropdown = document.querySelector(
                    '.ant-tree-treenode-selected'
                  );
                  if (dropdown) dropdown.classList.remove('ant-tree-treenode-selected');
                }, 0);
              }
            }}
            options={[
              { label: "全部", value: "all" },
              { label: "个人", value: "self" },
            ]}
          />
        )}
      </div>
    );
  };

  return (
    <Tree
      checkable
      checkStrictly
      defaultExpandAll
      selectable={false}
      height={400}
      treeData={treeData}
      checkedKeys={selectedKeys}
      onCheck={handleCheck}
      titleRender={titleRender}
      className="permission-tree"
    />
  );
}

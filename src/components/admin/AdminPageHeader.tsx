"use client";

import React from "react";
import { Button, Space } from "antd";
import type { ButtonProps, SpaceProps } from "antd";

function joinClassNames(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

interface AdminPageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  tag?: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
}

export function AdminPageHeader({
  title,
  description,
  icon,
  tag,
  extra,
  className,
}: AdminPageHeaderProps) {
  return (
    <div
      className={joinClassNames(
        "mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {icon}
          <h1 className="m-0 truncate text-xl font-semibold leading-8 tracking-normal text-slate-950">
            {title}
          </h1>
          {tag}
        </div>
        {description ? (
          <p className="mt-1 mb-0 text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>
      {extra ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{extra}</div>
      ) : null}
    </div>
  );
}

export function AdminTableActions({
  children,
  className,
  size = 4,
  ...props
}: SpaceProps) {
  return (
    <Space
      size={size}
      wrap
      className={joinClassNames("admin-table-actions", className)}
      {...props}
    >
      {children}
    </Space>
  );
}

export function AdminActionButton({
  children,
  variant = "link",
  size = "small",
  ...props
}: ButtonProps) {
  return (
    <Button variant={variant} size={size} {...props}>
      {children}
    </Button>
  );
}

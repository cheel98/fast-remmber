"use client"

import * as React from "react"
import { Palette, Check } from "lucide-react"
import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function SkinToggle() {
  const { setTheme, theme } = useTheme()
  const t = useTranslations("Skins")

  const skins = [
    { id: "dark", color: "bg-[#0a0b10]", label: t("dark") },
    { id: "light-snow", color: "bg-white", border: "border-gray-200", label: t("light-snow") },
    { id: "light-slate", color: "bg-[#f1f2f4]", label: t("light-slate") },
    { id: "light-lavender", color: "bg-[#faf9ff]", label: t("light-lavender") },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-background/50 backdrop-blur-sm border shadow-sm hover:bg-muted transition-all">
          <Palette className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">{t("title")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 mt-2">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          {t("title")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {skins.map((skin) => (
          <DropdownMenuItem
            key={skin.id}
            onClick={() => setTheme(skin.id)}
            className="flex items-center justify-between cursor-pointer py-2"
          >
            <div className="flex items-center gap-3">
              <div 
                className={cn(
                  "h-4 w-4 rounded-full border shadow-sm",
                  skin.color,
                  skin.border || "border-border"
                )} 
              />
              <span className={cn(
                "text-sm font-medium",
                theme === skin.id ? "text-primary" : "text-muted-foreground"
              )}>
                {skin.label}
              </span>
            </div>
            {theme === skin.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

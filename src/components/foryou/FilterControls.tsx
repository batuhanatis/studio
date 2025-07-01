
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Filter, X } from 'lucide-react';

export interface Genre {
  id: number;
  name: string;
}

export interface Platform {
  provider_id: number;
  provider_name: string;
}

export interface Filters {
  genres: number[];
  platforms: number[];
  year: [number, number];
  hideWatched: boolean;
}

interface FilterControlsProps {
  allGenres: Genre[];
  allPlatforms: Platform[];
  filters: Filters;
  onFilterChange: (newFilters: Filters) => void;
  loading: boolean;
}

export function FilterControls({
  allGenres,
  allPlatforms,
  filters,
  onFilterChange,
  loading,
}: FilterControlsProps) {
  const [open, setOpen] = useState(false);

  const handleGenreChange = (genreId: number) => {
    const newGenres = filters.genres.includes(genreId)
      ? filters.genres.filter((id) => id !== genreId)
      : [...filters.genres, genreId];
    onFilterChange({ ...filters, genres: newGenres });
  };

  const handlePlatformChange = (platformId: number) => {
    const newPlatforms = filters.platforms.includes(platformId)
      ? filters.platforms.filter((id) => id !== platformId)
      : [...filters.platforms, platformId];
    onFilterChange({ ...filters, platforms: newPlatforms });
  };
  
  const handleYearChange = (newYear: [number, number]) => {
     onFilterChange({ ...filters, year: newYear });
  };

  const handleHideWatchedChange = (checked: boolean) => {
    onFilterChange({ ...filters, hideWatched: checked });
  };
  
  const resetFilters = () => {
    onFilterChange({
        genres: [],
        platforms: [],
        year: [1980, new Date().getFullYear()],
        hideWatched: filters.hideWatched
    })
  }
  
  const activeFilterCount = filters.genres.length + filters.platforms.length;

  return (
     <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" disabled={loading}>
                    <Filter className="mr-2 h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && (
                        <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                            {activeFilterCount}
                        </span>
                    )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                    <div className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Filters</h4>
                        <p className="text-sm text-muted-foreground">
                        Adjust your recommendations.
                        </p>
                    </div>
                    <div className="grid gap-6">
                        <div className="grid gap-3">
                            <Label>Genre</Label>
                             <ScrollArea className="h-40 rounded-md border p-2">
                                {allGenres.map((genre) => (
                                <div key={genre.id} className="flex items-center space-x-2 py-1">
                                    <Checkbox
                                        id={`genre-${genre.id}`}
                                        checked={filters.genres.includes(genre.id)}
                                        onCheckedChange={() => handleGenreChange(genre.id)}
                                    />
                                    <Label htmlFor={`genre-${genre.id}`} className="font-normal">{genre.name}</Label>
                                </div>
                                ))}
                            </ScrollArea>
                        </div>
                        <div className="grid gap-3">
                            <Label>Streaming On</Label>
                            <ScrollArea className="h-40 rounded-md border p-2">
                                {allPlatforms.map((platform) => (
                                <div key={platform.provider_id} className="flex items-center space-x-2 py-1">
                                    <Checkbox
                                        id={`platform-${platform.provider_id}`}
                                        checked={filters.platforms.includes(platform.provider_id)}
                                        onCheckedChange={() => handlePlatformChange(platform.provider_id)}
                                    />
                                    <Label htmlFor={`platform-${platform.provider_id}`} className="font-normal">{platform.provider_name}</Label>
                                </div>
                                ))}
                            </ScrollArea>
                        </div>
                        <div className="grid gap-3">
                            <Label>Release Year: {filters.year[0]} - {filters.year[1]}</Label>
                            <Slider
                                value={filters.year}
                                onValueChange={handleYearChange}
                                min={1950}
                                max={new Date().getFullYear()}
                                step={1}
                            />
                        </div>
                    </div>
                     {activeFilterCount > 0 && <Button variant="ghost" size="sm" onClick={resetFilters}><X className="mr-2 h-4 w-4" /> Reset Filters</Button>}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
        <div className="flex items-center space-x-2">
            <Switch
                id="hide-watched"
                checked={filters.hideWatched}
                onCheckedChange={handleHideWatchedChange}
                disabled={loading}
            />
            <Label htmlFor="hide-watched">Hide Watched</Label>
        </div>
     </div>
  );
}


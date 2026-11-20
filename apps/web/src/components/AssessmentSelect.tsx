import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AssessmentSelectProps<Value extends string> {
  id: string;
  value: Value | "";
  onValueChange: (value: Value | "") => void;
  options: readonly { value: Value; label: string }[];
  placeholder: string;
  required?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export function AssessmentSelect<Value extends string>({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  required,
  ...triggerProps
}: AssessmentSelectProps<Value>) {
  const items = [{ value: null, label: placeholder }, ...options];

  return (
    <Select<Value>
      name={id}
      value={value || null}
      onValueChange={(selected) => onValueChange(selected ?? "")}
      items={items}
      required={required}
    >
      <SelectTrigger id={id} className="w-full" aria-required={required} {...triggerProps}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value ?? "placeholder"} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

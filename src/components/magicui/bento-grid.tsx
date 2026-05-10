import { cn } from "@/lib/utils";

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-[22rem] grid-cols-3 gap-4",
        className
      )}
    >
      {children}
    </div>
  );
};

export const BentoCard = ({
  className,
  name,
  description,
  Icon,
  children,
}: {
  className?: string;
  name: string;
  description: string;
  Icon: React.ElementType;
  children?: React.ReactNode;
}) => (
  <div
    className={cn(
      "group relative flex flex-col justify-between overflow-hidden rounded-xl",
      "bg-white border border-gray-100 shadow-sm",
      "hover:border-gray-200 hover:shadow-md transition-all duration-300",
      className
    )}
  >
    <div className="z-10 flex flex-col gap-1 p-6 transition-all duration-300 group-hover:-translate-y-1">
      <Icon className="h-10 w-10 origin-left transform-gpu text-neutral-700 transition-all duration-300 ease-in-out group-hover:scale-75 group-hover:text-[--yc-orange]" />
      <h3 className="text-xl font-semibold text-neutral-800">{name}</h3>
      <p className="max-w-lg text-neutral-500">{description}</p>
    </div>
    <div className="absolute top-0 right-0 p-6 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <div className="h-8 w-8 rounded-full bg-[--yc-orange] flex items-center justify-center text-white">
        &rarr;
      </div>
    </div>
    {children && <div className="z-10 px-6 pb-6 pt-0">{children}</div>}
  </div>
);

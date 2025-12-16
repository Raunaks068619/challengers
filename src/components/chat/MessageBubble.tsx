import { format } from "date-fns";

interface MessageBubbleProps {
    message: {
        text: string;
        senderId: string;
        timestamp: any;
        senderName?: string;
        senderAvatar?: string;
    };
    isOwn: boolean;
}

export default function MessageBubble({ message, isOwn }: MessageBubbleProps) {
    const time = message.timestamp?.toDate ? format(message.timestamp.toDate(), "h:mm a") : "";

    return (
        <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
            <div className={`flex items-end gap-2 max-w-[70%] ${isOwn ? "flex-row-reverse" : ""}`}>
                {!isOwn && message.senderAvatar && (
                    <img src={message.senderAvatar} alt="avatar" className="w-6 h-6 rounded-full mb-1" />
                )}

                <div className={`p-3 rounded-2xl ${isOwn
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}>
                    {!isOwn && message.senderName && (
                        <p className="text-xs font-semibold mb-1 opacity-70">{message.senderName}</p>
                    )}
                    <p className="text-sm">{message.text}</p>
                    <p className="text-[10px] mt-1 opacity-70 text-right">{time}</p>
                </div>
            </div>
        </div>
    );
}

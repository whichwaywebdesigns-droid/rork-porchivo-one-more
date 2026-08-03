import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Platform,
  ActivityIndicator, FlatList, TextInput, KeyboardAvoidingView, Image as RNImage,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ChevronLeft, Send as SendIcon, ImagePlus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, AppColors } from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import { useShipments } from '@/store/ShipmentsContext';
import { supabase } from '@/lib/supabase';
import { DbChatMessage } from '@/types/database';
import { log } from "@/lib/logger";

interface ChatMessage {
  id: string;
  text: string;
  imageUrl: string | null;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  createdAt: string;
}

function dbToMessage(msg: DbChatMessage): ChatMessage {
  return {
    id: msg.id,
    text: msg.text,
    imageUrl: msg.image_url,
    senderId: msg.sender_id,
    senderName: msg.sender_name,
    senderAvatarUrl: msg.sender_avatar_url,
    createdAt: msg.created_at,
  };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function MessageBubble({ message, isMe }: { message: ChatMessage; isMe: boolean }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.bubbleRow, isMe ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
      {!isMe &&
        (message.senderAvatarUrl ? (
          <ExpoImage
            source={{ uri: message.senderAvatarUrl }}
            style={styles.avatarCircle}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
          />
        ) : (
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{message.senderName?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
        ))}
      <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
        {!isMe && <Text style={styles.senderName}>{message.senderName}</Text>}
        {message.imageUrl ? (
          <RNImage source={{ uri: message.imageUrl }} style={styles.messageImage} resizeMode="cover" />
        ) : null}
        {message.text ? (
          <Text style={[styles.bubbleText, isMe ? styles.bubbleTextRight : styles.bubbleTextLeft]}>
            {message.text}
          </Text>
        ) : null}
        <Text style={[styles.timeText, isMe ? styles.timeTextRight : styles.timeTextLeft]}>
          {formatTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { shipmentId } = useLocalSearchParams<{ shipmentId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const { shipments } = useShipments();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [inputText, setInputText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const flatListRef = useRef<FlatList>(null);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const shipment = shipments.find(s => s.id === shipmentId);
  const otherName = shipment
    ? (shipment.homeownerId === user?.id ? shipment.partnerName : shipment.homeownerName)
    : 'Chat';

  useEffect(() => {
    if (!shipmentId || !user?.id) return;

    log('[Chat] Loading messages for shipment:', shipmentId);

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('shipment_id', shipmentId)
          .order('created_at', { ascending: true });

        if (error) {
          log('[Chat] Fetch error:', error.message);
          setLoading(false);
          return;
        }

        const mapped = (data as DbChatMessage[]).map(dbToMessage);
        log('[Chat] Loaded', mapped.length, 'messages');
        setMessages(mapped);
      } catch (err) {
        log('[Chat] Fetch exception:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchMessages();

    const channel = supabase
      .channel(`chat-${shipmentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `shipment_id=eq.${shipmentId}`,
        },
        (payload) => {
          log('[Chat] Real-time message received');
          const newMsg = dbToMessage(payload.new as DbChatMessage);
          setMessages((prev) => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe((status) => {
        log('[Chat] Subscription status:', status);
      });

    subscriptionRef.current = channel;

    return () => {
      log('[Chat] Cleaning up subscription');
      if (subscriptionRef.current) {
        void supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [shipmentId, user?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!user?.id || !shipmentId || !inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    const optimisticMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      text,
      imageUrl: null,
      senderId: user.id,
      senderName: user.name,
      senderAvatarUrl: user.avatarUrl,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const { error } = await supabase.from('chat_messages').insert({
        shipment_id: shipmentId,
        sender_id: user.id,
        sender_name: user.name,
        sender_avatar_url: user.avatarUrl,
        text,
        image_url: null,
      });

      if (error) {
        log('[Chat] Send error:', error.message);
        Alert.alert('Send failed', 'Could not send message. Please try again.');
        setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      }
    } catch (err) {
      log('[Chat] Send exception:', err);
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    } finally {
      setSending(false);
    }
  }, [user, shipmentId, inputText, sending]);

  const handlePickImage = useCallback(async () => {
    if (!user?.id || !shipmentId) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Permission to access your photo library is required to send photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const localUri = result.assets[0].uri;

      const { error } = await supabase.from('chat_messages').insert({
        shipment_id: shipmentId,
        sender_id: user.id,
        sender_name: user.name,
        sender_avatar_url: user.avatarUrl,
        text: '',
        image_url: localUri,
      });

      if (error) {
        log('[Chat] Image send error:', error.message);
        Alert.alert('Send failed', 'Could not send image. Please try again.');
      }
    } catch (err) {
      log('[Chat] Image pick error:', err);
    }
  }, [user, shipmentId]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => (
    <MessageBubble message={item} isMe={item.senderId === user?.id} />
  ), [user?.id]);

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  if (!user) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Chat' }} />
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Please sign in to chat.</Text>
        </View>
      </View>
    );
  }

  if (!shipment) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Chat' }} />
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Shipment not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: otherName ?? 'Chat',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
              <ChevronLeft size={24} color={colors.slate} strokeWidth={2} />
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            contentContainerStyle={[
              styles.messagesList,
              messages.length === 0 && styles.emptyList,
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatTitle}>No messages yet</Text>
                <Text style={styles.emptyChatSub}>
                  Start the conversation with {otherName ?? 'your neighbor'}
                </Text>
              </View>
            }
          />
        )}

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TouchableOpacity
            style={styles.imagePickerBtn}
            onPress={handlePickImage}
            activeOpacity={0.7}
            testID="chat-image-picker"
          >
            <ImagePlus size={20} color={colors.primary} />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={colors.slateLighter}
            multiline
            maxLength={1000}
            returnKeyType="default"
            testID="chat-input"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.7}
            testID="chat-send"
          >
            <SendIcon size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      color: colors.slateLight,
    },
    emptyText: {
      fontSize: 15,
      color: colors.slateLight,
    },
    messagesList: {
      paddingHorizontal: 12,
      paddingVertical: 12,
      flexGrow: 1,
    },
    emptyList: {
      justifyContent: 'center',
    },
    emptyChat: {
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyChatTitle: {
      fontSize: 17,
      fontWeight: '600' as const,
      color: colors.slate,
      marginBottom: 6,
    },
    emptyChatSub: {
      fontSize: 14,
      color: colors.slateLight,
      textAlign: 'center' as const,
      lineHeight: 20,
    },
    bubbleRow: {
      flexDirection: 'row',
      marginBottom: 8,
      alignItems: 'flex-end',
    },
    bubbleRowLeft: {
      justifyContent: 'flex-start',
    },
    bubbleRowRight: {
      justifyContent: 'flex-end',
    },
    avatarCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.skyBlue,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6,
    },
    avatarText: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: colors.primary,
    },
    bubble: {
      maxWidth: '75%',
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    bubbleLeft: {
      backgroundColor: colors.surface,
      borderBottomLeftRadius: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    bubbleRight: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },
    senderName: {
      fontSize: 11,
      fontWeight: '600' as const,
      color: colors.primary,
      marginBottom: 3,
    },
    bubbleText: {
      fontSize: 15,
      lineHeight: 20,
    },
    bubbleTextLeft: {
      color: colors.slate,
    },
    bubbleTextRight: {
      color: '#FFFFFF',
    },
    messageImage: {
      width: 200,
      height: 150,
      borderRadius: 10,
      marginBottom: 4,
    },
    timeText: {
      fontSize: 11,
      marginTop: 4,
    },
    timeTextLeft: {
      color: colors.slateLighter,
    },
    timeTextRight: {
      color: 'rgba(255,255,255,0.6)',
    },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 8,
      paddingTop: 8,
      gap: 6,
    },
    imagePickerBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.skyBlue,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    textInput: {
      flex: 1,
      backgroundColor: colors.elevated,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingTop: Platform.OS === 'ios' ? 10 : 8,
      paddingBottom: Platform.OS === 'ios' ? 10 : 8,
      fontSize: 15,
      color: colors.slate,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 100,
      lineHeight: 20,
    },
    sendBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    sendBtnDisabled: {
      backgroundColor: colors.slateLighter,
    },
  });
}

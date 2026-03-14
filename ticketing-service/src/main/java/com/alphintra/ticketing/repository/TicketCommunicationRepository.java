package com.alphintra.ticketing.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.alphintra.ticketing.model.CommunicationSenderType;
import com.alphintra.ticketing.model.TicketCommunication;

@Repository
public interface TicketCommunicationRepository extends JpaRepository<TicketCommunication, Long> {

    List<TicketCommunication> findByTicket_IdOrderByCreatedAtAsc(Long ticketId);

    long countByTicket_Id(Long ticketId);

    long countByTicket_IdAndReadAtIsNullAndSenderType(Long ticketId, CommunicationSenderType senderType);
}

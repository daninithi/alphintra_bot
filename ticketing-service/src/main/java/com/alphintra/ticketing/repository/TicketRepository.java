package com.alphintra.ticketing.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.alphintra.ticketing.model.Ticket;
import com.alphintra.ticketing.model.TicketStatus;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long> {

    List<Ticket> findByCustomerIdOrderByCreatedAtDesc(String customerId);

    List<Ticket> findByAssigneeIdOrderByCreatedAtDesc(Long assigneeId);

    List<Ticket> findByStatusOrderByCreatedAtDesc(TicketStatus status);

    List<Ticket> findByCustomerIdAndStatusOrderByCreatedAtDesc(String customerId, TicketStatus status);

    List<Ticket> findByAssigneeIdAndStatusOrderByCreatedAtDesc(Long assigneeId, TicketStatus status);
}